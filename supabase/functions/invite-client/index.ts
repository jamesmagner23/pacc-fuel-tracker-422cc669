import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { company_name, contact_name, contact_email, contact_phone } = await req.json();

    if (!company_name || !contact_email) {
      return new Response(JSON.stringify({ success: false, error: "Missing company_name or contact_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user with a random password (they'll reset via email)
    const tempPassword = crypto.randomUUID();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: contact_email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ success: false, error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Assign client role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "client" });

    if (roleError) {
      console.error("Role insert error:", roleError);
    }

    // Create client account
    const { error: accountError } = await supabase
      .from("client_accounts")
      .insert({
        auth_user_id: userId,
        company_name,
        contact_name: contact_name || null,
        contact_email,
        contact_phone: contact_phone || null,
      });

    if (accountError) {
      console.error("Account insert error:", accountError);
      return new Response(JSON.stringify({ success: false, error: accountError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send password reset email so the client can set their own password
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: contact_email,
    });

    if (resetError) {
      console.error("Reset email error:", resetError);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
