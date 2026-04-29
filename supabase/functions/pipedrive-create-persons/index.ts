import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Lead = { name: string; email: string; org?: string };
type ResultRow = {
  email: string;
  name: string;
  status: "created" | "exists" | "skipped" | "error";
  pipedrive_person_id?: number;
  message?: string;
};

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
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
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
    const leads: Lead[] = Array.isArray(body?.leads) ? body.leads : [];
    if (leads.length === 0) return json({ error: "No leads provided" }, 400);
    if (leads.length > 200) return json({ error: "Max 200 leads per import" }, 400);

    const base = `https://${PD_DOMAIN}.pipedrive.com/api/v1`;
    const results: ResultRow[] = [];

    for (const raw of leads) {
      const name = String(raw?.name ?? "").trim();
      const email = String(raw?.email ?? "").trim().toLowerCase();
      const org = String(raw?.org ?? "").trim();

      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        results.push({ email, name, status: "error", message: "Invalid email" });
        continue;
      }
      if (!name) {
        results.push({ email, name, status: "error", message: "Missing name" });
        continue;
      }

      try {
        // Search by email first to dedupe
        const searchUrl = `${base}/persons/search?` + new URLSearchParams({
          term: email,
          fields: "email",
          exact_match: "true",
          api_token: PD_TOKEN,
        });
        const sRes = await fetch(searchUrl);
        const sJson = await sRes.json();
        const existing = sJson?.data?.items?.[0]?.item;
        if (existing?.id) {
          results.push({ email, name, status: "exists", pipedrive_person_id: existing.id });
          continue;
        }

        // Resolve / create org
        let orgId: number | undefined;
        if (org) {
          const orgSearch = await fetch(
            `${base}/organizations/search?` + new URLSearchParams({
              term: org,
              exact_match: "true",
              api_token: PD_TOKEN,
            })
          );
          const orgJson = await orgSearch.json();
          const found = orgJson?.data?.items?.[0]?.item;
          if (found?.id) {
            orgId = found.id;
          } else {
            const orgCreate = await fetch(`${base}/organizations?api_token=${PD_TOKEN}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: org }),
            });
            const orgRes = await orgCreate.json();
            orgId = orgRes?.data?.id;
          }
        }

        // Create person
        const personRes = await fetch(`${base}/persons?api_token=${PD_TOKEN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email: [{ value: email, primary: true, label: "work" }],
            ...(orgId ? { org_id: orgId } : {}),
          }),
        });
        const personJson = await personRes.json();
        if (!personRes.ok || !personJson?.success) {
          results.push({ email, name, status: "error", message: personJson?.error || `HTTP ${personRes.status}` });
          continue;
        }
        results.push({ email, name, status: "created", pipedrive_person_id: personJson.data.id });
      } catch (e) {
        results.push({
          email, name, status: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return json({ results });
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