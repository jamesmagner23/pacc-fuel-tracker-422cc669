import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEED_DATA = {
  brent: 108.4, brentChange: +3.2,
  audUsd: 0.618, audUsdChange: -0.004,
  melbTGP: 251.3, melbTGPChange: -6.1,
  dieselReservesDays: 29, petrolReservesDays: 36,
  exciseCutCPL: 32.0, ftcRate: 26.3,
  hormuzStatus: "RESTRICTED", shipmentStatus: "DIVERTED",
  singaporeAgreement: true, panicBuyingLevel: "MODERATE", supplyRisk: "HIGH",
};

function buildPrompt(marketData: typeof SEED_DATA) {
  const today = new Date();
  const july1 = new Date("2026-07-01");
  const daysToJuly = Math.ceil((july1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const fmtDate = today.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return `You are an energy market intelligence analyst producing a daily classified briefing for PACC Fuel, a mobile diesel delivery business in Melbourne, Australia.

Today's date: ${fmtDate}
Days until fuel excise reversion (July 1): ${daysToJuly}

CURRENT MARKET DATA:
- Brent Crude: USD $${marketData.brent}/bbl (${marketData.brentChange > 0 ? "+" : ""}${marketData.brentChange} today)
- AUD/USD: ${marketData.audUsd} (${marketData.audUsdChange > 0 ? "+" : ""}${marketData.audUsdChange.toFixed(3)})
- Melbourne Diesel TGP: ${marketData.melbTGP}¢/L (post-excise cut)
- Diesel Reserve Days: ${marketData.dieselReservesDays} days nationally
- Strait of Hormuz: ${marketData.hormuzStatus}
- Inbound Shipment Status: ${marketData.shipmentStatus}
- Singapore Supply Agreement: ${marketData.singaporeAgreement ? "SECURED" : "NOT SECURED"}
- Current Excise Cut: ${marketData.exciseCutCPL}¢/L (expires June 30)
- FTC Rate (heavy vehicles on-road): ${marketData.ftcRate}¢/L

CONTEXT: Australia imports ~90% refined fuel from Asia. Six April tankers were cancelled/diverted. Gulf of Mexico supplies now being sourced (4-6 week sailing time). Gasoil arrivals tracking sharply lower in April vs January. Two domestic refineries (Geelong + Lytton) cover <20% of demand.

Produce a CLASSIFIED DAILY INTELLIGENCE BRIEFING with exactly these sections, written in sharp analyst style — direct, no fluff, actionable:

**SITUATION SUMMARY** (2 sentences max — what matters most today)

**CRUDE & PRICING OUTLOOK** (3 sentences — where Brent is heading and what it means for Melbourne TGP over 4-8 weeks)

**SUPPLY CHAIN THREAT ASSESSMENT** (3 sentences — shipping lanes, inbound volumes, risk of localized shortages in VIC)

**THE JULY 1 EXCISE CLIFF** (2 sentences — what happens when excise reverts, quantify the TGP impact)

**PROCUREMENT RECOMMENDATION** (3 sentences — specific actionable advice for a mobile diesel operator in Melbourne with a new truck arriving this week and growing customer base)

**RISK FLAGS** (bullet list of 3-4 items, max 12 words each)

Be specific with numbers. Be direct. Write like a Bloomberg analyst, not a PR department.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Determine if this is a cron (scheduled) call or interactive (streaming) call
    let marketData = { ...SEED_DATA };
    let isCron = false;

    try {
      const body = await req.json();
      if (body.scheduled || body.time) {
        isCron = true;
      }
      if (body.marketData) {
        marketData = { ...marketData, ...body.marketData };
      }
    } catch {
      // No body or invalid JSON — treat as cron
      isCron = true;
    }

    // For cron: fetch latest TGP from DB to enrich market data
    if (isCron) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const { data: tgpRows } = await supabase
        .from("terminal_gate_prices")
        .select("price_cpl, price_date")
        .eq("location", "Melbourne")
        .eq("product", "Diesel")
        .order("price_date", { ascending: false })
        .limit(2);

      if (tgpRows && tgpRows.length > 0) {
        marketData.melbTGP = tgpRows[0].price_cpl;
        if (tgpRows.length > 1) {
          marketData.melbTGPChange = +(tgpRows[0].price_cpl - tgpRows[1].price_cpl).toFixed(1);
        }
      }
    }

    const prompt = buildPrompt(marketData);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        stream: !isCron,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron mode: read full response and save to DB
    if (isCron) {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content || "";

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("market_briefings")
        .upsert({
          briefing_date: today,
          content,
          market_data: marketData,
          status: "generated",
        }, { onConflict: "briefing_date" });

      if (error) console.error("Failed to save briefing:", error);

      return new Response(
        JSON.stringify({ success: true, briefing_date: today, content_length: content.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Interactive mode: stream response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("market-briefing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
