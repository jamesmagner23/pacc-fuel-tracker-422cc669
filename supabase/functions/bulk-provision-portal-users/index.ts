import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const password: string = body.password ?? "123456";
    const dryRun: boolean = body.dry_run === true;

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: accounts, error: accErr } = await admin
      .from("client_accounts")
      .select("id, company_name, contact_email, auth_user_id, is_active")
      .is("auth_user_id", null)
      .eq("is_active", true);
    if (accErr) throw accErr;

    const results: any[] = [];
    const usedEmails = new Set<string>();

    for (const acc of accounts ?? []) {
      const slug = slugify(acc.company_name || `client${acc.id}`);
      let email = `portal@${slug}.com`;
      // Make unique within this batch
      if (usedEmails.has(email)) email = `portal+${acc.id}@${slug}.com`;
      usedEmails.add(email);

      if (dryRun) {
        results.push({ id: acc.id, company: acc.company_name, email, status: "dry_run" });
        continue;
      }

      try {
        // Create auth user (skip if email already exists in auth)
        let userId: string | null = null;
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: acc.company_name, client_account_id: acc.id },
        });
        if (createErr) {
          // If email exists, look it up
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          if (existing) {
            userId = existing.id;
          } else {
            throw createErr;
          }
        } else {
          userId = created.user!.id;
        }

        // Insert role row (skip on conflict)
        const { error: roleErr } = await admin.from("user_roles").insert({
          user_id: userId,
          role: "client",
          email,
          full_name: acc.company_name,
          client_account_id: acc.id,
        });
        if (roleErr && !String(roleErr.message).toLowerCase().includes("duplicate")) {
          throw roleErr;
        }

        // Link auth_user_id + email on client_accounts
        const { error: updErr } = await admin
          .from("client_accounts")
          .update({ auth_user_id: userId, contact_email: email })
          .eq("id", acc.id);
        if (updErr) throw updErr;

        results.push({ id: acc.id, company: acc.company_name, email, password, user_id: userId, status: "created" });
      } catch (err: any) {
        results.push({ id: acc.id, company: acc.company_name, email, status: "error", error: String(err?.message ?? err) });
      }
    }

    return new Response(
      JSON.stringify({
        total: accounts?.length ?? 0,
        created: results.filter(r => r.status === "created").length,
        errors: results.filter(r => r.status === "error").length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});