import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Polls Pipedrive Mailbox for the most recent mail thread that involves
 * a given person (and was sent at/after a given timestamp), and writes
 * the resulting status into outreach_thread_status.
 *
 * Status values:
 *   - 'pending' : we haven't found a thread yet
 *   - 'logged'  : a thread exists in Pipedrive (the BCC sync worked)
 *   - 'replied' : the thread has at least one inbound message
 *   - 'none'    : looked but found nothing (kept distinct from 'pending'
 *                 so the UI can show "no sync yet" vs "checked, nothing")
 *
 * Body: { send_ids?: string[] }   // if omitted, polls last 50 sends
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const PD_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const PD_DOMAIN = Deno.env.get("PIPEDRIVE_COMPANY_DOMAIN");
    if (!PD_TOKEN || !PD_DOMAIN) return json({ error: "Pipedrive not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const requested: string[] | undefined = Array.isArray(body?.send_ids) ? body.send_ids : undefined;

    // Use service role to bypass RLS for the join + writes (we already
    // verified the caller is an admin above)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = admin
      .from("outreach_send_log")
      .select("id, pipedrive_person_id, recipient_email, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (requested && requested.length > 0) {
      q = admin
        .from("outreach_send_log")
        .select("id, pipedrive_person_id, recipient_email, created_at")
        .in("id", requested);
    }
    const { data: sends, error: sendsErr } = await q;
    if (sendsErr) return json({ error: sendsErr.message }, 500);

    const base = `https://${PD_DOMAIN}.pipedrive.com/api/v1`;
    const updates: Array<{ send_id: string; status: string; thread_id: number | null; last_message_at: string | null }> = [];

    for (const s of sends ?? []) {
      if (!s.pipedrive_person_id) {
        updates.push({ send_id: s.id, status: "none", thread_id: null, last_message_at: null });
        continue;
      }
      try {
        const url = `${base}/mailbox/mailThreads?` + new URLSearchParams({
          folder: "sent",
          person_id: String(s.pipedrive_person_id),
          start: "0",
          limit: "20",
          api_token: PD_TOKEN,
        });
        const res = await fetch(url);
        const j = await res.json();
        const sentAt = new Date(s.created_at).getTime();
        const threads: any[] = Array.isArray(j?.data) ? j.data : [];
        // Match a thread sent at/after our send (allow 5min skew before)
        const candidate = threads.find((t: any) => {
          const ts = new Date(t.message_time || t.add_time || 0).getTime();
          return ts >= sentAt - 5 * 60 * 1000;
        }) ?? threads[0];

        if (!candidate) {
          updates.push({ send_id: s.id, status: "none", thread_id: null, last_message_at: null });
          continue;
        }

        const hasReply = (candidate.has_reply ?? candidate.reply_count > 0) ||
                         (candidate.read_flag === 0 && candidate.parties?.to?.length);
        const status = hasReply ? "replied" : "logged";
        updates.push({
          send_id: s.id,
          status,
          thread_id: candidate.id,
          last_message_at: candidate.message_time || candidate.add_time || null,
        });
      } catch {
        updates.push({ send_id: s.id, status: "pending", thread_id: null, last_message_at: null });
      }
    }

    // Upsert
    if (updates.length > 0) {
      const rows = updates.map(u => ({
        send_id: u.send_id,
        status: u.status,
        pipedrive_thread_id: u.thread_id,
        last_message_at: u.last_message_at,
        last_polled_at: new Date().toISOString(),
      }));
      const { error: upErr } = await admin
        .from("outreach_thread_status")
        .upsert(rows, { onConflict: "send_id" });
      if (upErr) return json({ error: upErr.message }, 500);
    }

    return json({ updated: updates.length, statuses: updates });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}