import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VIVA_URL = "https://www.vivaenergy.com.au/quick-links/terminal-gate-pricing";

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

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const res = await fetch(VIVA_URL, {
      headers: { "User-Agent": "Mozilla/5.0 PACC-TGP-Scraper" },
    });
    if (!res.ok) throw new Error(`Viva fetch failed: ${res.status}`);
    const html = await res.text();

    const priceDate = parseAsAtDate(html);

    // Isolate the tgp-table block
    const tableMatch = html.match(/<table[^>]*tgp-table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) throw new Error("tgp-table not found");
    const tableHtml = tableMatch[1];

    const records: Array<{
      price_date: string;
      location: string;
      product: string;
      price_cpl: number;
      source: string;
    }> = [];

    let lastState = "";
    const rowRegex = /<tr[^>]*tgp-row[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      const cells: string[] = [];
      let cm: RegExpExecArray | null;
      while ((cm = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(stripTags(cm[1]));
      }
      // Skip header
      if (cells[0]?.toLowerCase() === "state") continue;
      if (cells.length < 3) continue;

      const state = cells[0] || lastState;
      if (cells[0]) lastState = cells[0];
      const city = cells[1];
      if (!city) continue;

      // Diesel inc-GST cents per litre → ex-GST $/L (consistent with terminal_gate_prices)
      for (const [product, idx] of Object.entries(PRODUCT_COL)) {
        const raw = cells[2 + idx];
        const cpl = parseFloat(raw);
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
      const { error } = await supabase
        .from("terminal_gate_prices")
        .upsert(records, { onConflict: "price_date,location,product" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, price_date: priceDate, records: records.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Viva TGP error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});