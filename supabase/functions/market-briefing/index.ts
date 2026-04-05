import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { marketData } = await req.json();

    const today = new Date();
    const july1 = new Date("2026-07-01");
    const daysToJuly = Math.ceil((july1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const fmtDate = today.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    const prompt = `You are an energy market intelligence analyst producing a daily classified briefing for PACC Fuel, a mobile diesel delivery business in Melbourne, Australia.

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
