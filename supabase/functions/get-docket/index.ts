import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const idsParam = url.searchParams.get("ids");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let items: any[] = [];

    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter(Boolean);
      if (ids.length === 0) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin
        .from("transactions")
        .select("*")
        .in("id", ids)
        .order("fecha", { ascending: true });
      if (error) throw error;
      items = data || [];
    } else if (id) {
      const { data: anchor, error: aerr } = await admin
        .from("transactions")
        .select("*")
        .eq("id", Number(id))
        .maybeSingle();
      if (aerr) throw aerr;
      if (!anchor) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: related, error: rerr } = await admin
        .from("transactions")
        .select("*")
        .eq("date", anchor.date)
        .eq("nombre_cliente1", anchor.nombre_cliente1)
        .eq("estacion", anchor.estacion)
        .order("fecha", { ascending: true });
      if (rerr) throw rerr;
      items = related && related.length > 0 ? related : [anchor];
    }

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e), items: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});