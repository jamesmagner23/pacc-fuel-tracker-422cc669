import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VIVA_URL = "https://www.vivaenergy.com.au/quick-links/terminal-gate-pricing";
// Viva blocks datacenter IPs / Deno UA. r.jina.ai is a free reader proxy that
// returns the rendered page as markdown — no API key required.
const PROXY_URL = `https://r.jina.ai/${VIVA_URL}`;

// Column index of each fuel within the Viva tgp-table (after State, City).
// Header order: Unleaded, Premium ULP, ULP E10, ULP 98, Diesel, Biodiesel B5
const PRODUCT_COL: Record<string, number> = {
  ULP: 0,
  Diesel: 4,
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseAsAtDate(html: string): string {
  // "TGP) as at 09 May 2026"
  const m = html.match(/as at\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!m) return new Date().toISOString().slice(0, 10);
  const day = m[1].padStart(2, "0");
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()] || "01";
  return `${m[3]}-${month}-${day}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const res = await fetch(PROXY_URL, {
      headers: { Accept: "text/markdown" },
    });
    if (!res.ok) throw new Error(`Viva fetch failed: ${res.status}`);
    const md = await res.text();

    const priceDate = parseAsAtDate(md);

    // Markdown table rows look like:
    //   | VICTORIA | MELBOURNE | 175.42 | 183.62 | 176.52 | 197.79 | 209.13 | -- |
    // After "| ":  state | city | ULP | PULP | ULP-E10 | ULP-98 | Diesel | B5
    const records: Array<{
      price_date: string;
      location: string;
      product: string;
      price_cpl: number;
      source: string;
    }> = [];

    let lastState = "";
    for (const line of md.split("\n")) {
      if (!line.startsWith("|")) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length < 8) continue;
      // Skip header / separator rows
      if (/^state$/i.test(cells[0]) || /^-+$/.test(cells[0])) continue;
      if (cells[0]) lastState = cells[0];
      const city = cells[1];
      if (!city || /^city$/i.test(city)) continue;
      for (const [product, idx] of Object.entries(PRODUCT_COL)) {
        const cpl = parseFloat(cells[2 + idx]);
        if (!Number.isFinite(cpl)) continue;
        records.push({
          price_date: priceDate,
          location: city.charAt(0) + city.slice(1).toLowerCase(),
          product,
          price_cpl: cpl,
          source: "Viva",
        });
      }
    }

    if (records.length > 0) {
      // Delete-then-insert avoids relying on PostgREST's cached onConflict
      // shape (which can lag schema changes).
      const { error: delErr } = await supabase
        .from("terminal_gate_prices")
        .delete()
        .eq("price_date", priceDate)
        .eq("source", "Viva");
      if (delErr) throw delErr;
      const { error: insErr } = await supabase
        .from("terminal_gate_prices")
        .insert(records);
      if (insErr) throw insErr;
    }

    // Pro Fusion buy price = Viva Melbourne Diesel TGP - 1.5 cpl (inc-GST),
    // effective on the same date as the Viva "as at" daily TGP.
    // Per supplier: they no longer email prices; Viva TGP minus 1.5c is the rule.
    const vivaMelbDiesel = records.find(
      (r) => r.product === "Diesel" && r.location.toLowerCase() === "melbourne",
    );
    let proFusionPrice: number | null = null;
    if (vivaMelbDiesel) {
      proFusionPrice = +((vivaMelbDiesel.price_cpl - 1.5) / 100).toFixed(4);
      const { error: bpErr } = await supabase
        .from("buy_prices")
        .upsert(
          {
            price_date: priceDate,
            supplier: "Pro Fusion",
            price_per_litre: proFusionPrice,
            notes: `Auto-derived from Viva Melbourne Diesel TGP as at ${priceDate} (${vivaMelbDiesel.price_cpl.toFixed(2)}¢) − 1.5¢ inc-GST per supplier agreement`,
          },
          { onConflict: "price_date,supplier" },
        );
      if (bpErr) throw bpErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        price_date: priceDate,
        records: records.length,
        pro_fusion_price: proFusionPrice,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Viva TGP error:", e);
    const msg = e instanceof Error ? e.message
      : (typeof e === "object" ? JSON.stringify(e) : String(e));
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});