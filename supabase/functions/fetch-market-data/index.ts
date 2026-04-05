import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Free forex API (no key required)
const FOREX_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
// Fallback forex API
const FOREX_FALLBACK = "https://open.er-api.com/v6/latest/USD";

async function fetchAudUsd(): Promise<number | null> {
  try {
    const resp = await fetch(FOREX_URL);
    if (resp.ok) {
      const data = await resp.json();
      // This API gives USD -> other currencies, so AUD/USD = 1 / usd.aud
      const audRate = data?.usd?.aud;
      if (audRate) return +(1 / audRate).toFixed(4);
    }
  } catch (e) {
    console.error("Primary forex fetch failed:", e);
  }

  // Fallback
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

// Free oil price from a public JSON endpoint
const OIL_URL = "https://cdn.jsdelivr.net/npm/@nicfv/oilprice/data.json";

async function fetchBrentCrude(): Promise<number | null> {
  try {
    const resp = await fetch(OIL_URL);
    if (resp.ok) {
      const data = await resp.json();
      // This package provides Brent price in USD/bbl
      if (data?.brent) return +Number(data.brent).toFixed(2);
    }
  } catch (e) {
    console.error("Oil price fetch failed:", e);
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
    const results: Record<string, { value: number | null; source: string }> = {};

    // Fetch AUD/USD
    const audUsd = await fetchAudUsd();
    results.aud_usd = { value: audUsd, source: "exchangerate-api" };

    // Fetch Brent crude
    const brent = await fetchBrentCrude();
    results.brent_crude = { value: brent, source: "oilprice-cdn" };

    // Get previous values for change calculation
    for (const [metricName, result] of Object.entries(results)) {
      if (result.value === null) continue;

      // Get yesterday's value as previous_value
      const { data: prev } = await supabase
        .from("market_metrics")
        .select("value")
        .eq("metric_name", metricName)
        .lt("metric_date", today)
        .order("metric_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase
        .from("market_metrics")
        .upsert({
          metric_name: metricName,
          metric_date: today,
          value: result.value,
          previous_value: prev?.value ?? null,
          source: result.source,
          updated_at: new Date().toISOString(),
        }, { onConflict: "metric_name,metric_date" });

      if (error) console.error(`Failed to upsert ${metricName}:`, error);
    }

    return new Response(
      JSON.stringify({ success: true, date: today, results }),
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
