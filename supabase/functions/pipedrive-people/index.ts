import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log("pipedrive-people invoked", req.method);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("entering try block");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    console.log("env check", { hasUrl: !!SUPABASE_URL, hasAnon: !!SUPABASE_ANON_KEY });
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    console.log("auth header present", !!authHeader);
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );
    console.log("client created");

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    console.log("getUser done", { hasUser: !!userData?.user, err: userErr?.message });
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PD_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const PD_DOMAIN = Deno.env.get("PIPEDRIVE_COMPANY_DOMAIN");
    if (!PD_TOKEN || !PD_DOMAIN) {
      return new Response(
        JSON.stringify({ error: "Pipedrive not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let term = "";
    let limit = 25;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      term = String(body?.q ?? "").trim();
      limit = Math.min(Number(body?.limit ?? 25) || 25, 100);
    } else {
      const url = new URL(req.url);
      term = (url.searchParams.get("q") ?? "").trim();
      limit = Math.min(
        Number(url.searchParams.get("limit") ?? "25") || 25,
        100
      );
    }

    const base = `https://${PD_DOMAIN}.pipedrive.com/api/v1`;

    let pdUrl: string;
    if (term.length >= 2) {
      // Use Pipedrive search for filtered queries
      const params = new URLSearchParams({
        term,
        item_types: "person",
        fields: "name,email",
        limit: String(limit),
        api_token: PD_TOKEN,
      });
      pdUrl = `${base}/itemSearch?${params.toString()}`;
    } else {
      // List recent persons
      const params = new URLSearchParams({
        limit: String(limit),
        sort: "update_time DESC",
        api_token: PD_TOKEN,
      });
      pdUrl = `${base}/persons?${params.toString()}`;
    }

    const pdRes = await fetch(pdUrl);
    const rawText = await pdRes.text();
    let pdJson: any = null;
    try { pdJson = JSON.parse(rawText); } catch { /* not json */ }
    console.log("Pipedrive call", { url: pdUrl.replace(PD_TOKEN, "***"), status: pdRes.status, ok: pdRes.ok, bodyPreview: rawText.slice(0, 300) });
    if (!pdRes.ok || !pdJson || pdJson.success === false) {
      return new Response(
        JSON.stringify({
          error: `Pipedrive request failed (status ${pdRes.status})`,
          details: pdJson ?? rawText.slice(0, 500),
        }),
        {
          status: 200, // return 200 so supabase-js surfaces our message instead of generic non-2xx
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    type PersonOut = {
      id: number;
      name: string;
      email: string | null;
      org_name: string | null;
      owner_name: string | null;
      pipedrive_url: string;
    };

    const persons: PersonOut[] = [];

    if (term.length >= 2) {
      const items = pdJson?.data?.items ?? [];
      for (const it of items) {
        const p = it.item ?? {};
        const emails: string[] = Array.isArray(p.emails) ? p.emails : [];
        persons.push({
          id: p.id,
          name: p.name ?? "(no name)",
          email: emails[0] ?? null,
          org_name: p.organization?.name ?? null,
          owner_name: null,
          pipedrive_url: `https://${PD_DOMAIN}.pipedrive.com/person/${p.id}`,
        });
      }
    } else {
      const items = pdJson?.data ?? [];
      for (const p of items) {
        const primaryEmail =
          (p.email ?? []).find((e: any) => e.primary)?.value ??
          (p.email ?? [])[0]?.value ??
          null;
        persons.push({
          id: p.id,
          name: p.name ?? "(no name)",
          email: primaryEmail,
          org_name: p.org_name ?? p.org_id?.name ?? null,
          owner_name: p.owner_name ?? p.owner_id?.name ?? null,
          pipedrive_url: `https://${PD_DOMAIN}.pipedrive.com/person/${p.id}`,
        });
      }
    }

    return new Response(
      JSON.stringify({
        persons,
        bcc: Deno.env.get("PIPEDRIVE_BCC_EMAIL") ?? null,
        company_domain: PD_DOMAIN,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("pipedrive-people crashed", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const stack = e instanceof Error ? e.stack : undefined;
    return new Response(JSON.stringify({ error: msg, stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});