import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, password, full_name, client_account_id, role } = await req.json();
    const userRole: string = role || "client";
    const validRoles = ["admin", "operations", "driver", "client"];
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!validRoles.includes(userRole)) {
      return new Response(JSON.stringify({ error: `invalid role: ${userRole}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (userRole === "client" && !client_account_id) {
      return new Response(JSON.stringify({ error: "client_account_id required for client role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr) throw createErr;
    const userId = created.user!.id;

    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: userId,
      role: userRole,
      email,
      full_name,
      client_account_id: userRole === "client" ? client_account_id : null,
    });
    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({ ok: true, user_id: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
