import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Free forex APIs (no key required)
const FOREX_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const FOREX_FALLBACK = "https://open.er-api.com/v6/latest/USD";

async function fetchAudUsd(): Promise<number | null> {
  try {
    const resp = await fetch(FOREX_URL);
    if (resp.ok) {
      const data = await resp.json();
      const audRate = data?.usd?.aud;
      if (audRate) return +(1 / audRate).toFixed(4);
    }
  } catch (e) {
    console.error("Primary forex fetch failed:", e);
  }

  try {
    const resp = await fetch(FOREX_FALLBACK);
    if (resp.ok) {
      const data = await resp.json();
      const audRate = data?.rates?.AUD;
      if (audRate) return +(1 / audRate).toFixed(4);
    }
  } catch (e) {
    console.error("Fallback forex fetch failed:", e);
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    // Fetch AUD/USD from free API
    const audUsd = await fetchAudUsd();

    const metrics: Array<{ name: string; value: number; source: string }> = [];
    if (audUsd !== null) {
      metrics.push({ name: "aud_usd", value: audUsd, source: "exchangerate-api" });
    }

    // Also accept manual values from the request body
    try {
      const body = await req.clone().json();
      if (body?.brent_crude && typeof body.brent_crude === "number") {
        metrics.push({ name: "brent_crude", value: body.brent_crude, source: "manual" });
      }
    } catch { /* no body or scheduled call */ }

    // Upsert each metric with previous value tracking
    for (const metric of metrics) {
      const { data: prev } = await supabase
        .from("market_metrics")
        .select("value")
        .eq("metric_name", metric.name)
        .lt("metric_date", today)
        .order("metric_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase
        .from("market_metrics")
        .upsert({
          metric_name: metric.name,
          metric_date: today,
          value: metric.value,
          previous_value: prev?.value ?? null,
          source: metric.source,
          updated_at: new Date().toISOString(),
        }, { onConflict: "metric_name,metric_date" });

      if (error) console.error(`Failed to upsert ${metric.name}:`, error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        metrics_updated: metrics.map(m => ({ name: m.name, value: m.value })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-market-data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
