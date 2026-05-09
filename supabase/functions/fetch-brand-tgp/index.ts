import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Each brand publishes a TGP table; we fetch via r.jina.ai markdown proxy
// and extract the first numeric value on a line containing both "Melbourne"
// and (for diesel pages) typically the diesel price column.
const BRANDS: Array<{
  name: string;
  url: string;
  // Index of the diesel column among the numeric cells found on the
  // Melbourne row (0-based). Adjust per brand if scraping returns wrong column.
  dieselIdx: number;
}> = [
  // Ampol publishes a Melbourne row with multiple products
  { name: "Ampol", url: "https://www.ampol.com.au/about-ampol/fuel-pricing/terminal-gate-pricing", dieselIdx: 1 },
  // BP TGP page
  { name: "BP", url: "https://www.bp.com/en_au/australia/home/products-and-services/bp-fuels/fuel-pricing.html", dieselIdx: 1 },
  // Mobil TGP
  { name: "Mobil", url: "https://www.mobil.com.au/en-au/fuel/terminal-gate-pricing", dieselIdx: 1 },
  // 7-Eleven TGP
  { name: "7-Eleven", url: "https://www.7eleven.com.au/fuel/terminal-gate-pricing", dieselIdx: 1 },
];

async function scrapeBrand(brand: typeof BRANDS[number]): Promise<number | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${brand.url}`, {
      headers: { Accept: "text/markdown" },
    });
    if (!res.ok) return null;
    const md = await res.text();
    for (const line of md.split("\n")) {
      if (!/melbourne/i.test(line)) continue;
      const nums = (line.match(/\d{2,3}\.\d{1,3}/g) || [])
        .map((n) => parseFloat(n))
        .filter((n) => n > 50 && n < 400);
      if (nums.length > brand.dieselIdx) return nums[brand.dieselIdx];
      if (nums.length > 0) return nums[nums.length - 1];
    }
  } catch (e) {
    console.error(`Scrape ${brand.name} failed:`, e);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);
    const results: Array<{ brand: string; price: number | null }> = [];

    for (const b of BRANDS) {
      const price = await scrapeBrand(b);
      results.push({ brand: b.name, price });
      if (price != null) {
        await supabase
          .from("terminal_gate_prices")
          .delete()
          .eq("price_date", today)
          .eq("source", b.name)
          .eq("location", "Melbourne")
          .eq("product", "Diesel");
        const { error } = await supabase.from("terminal_gate_prices").insert({
          price_date: today,
          source: b.name,
          location: "Melbourne",
          product: "Diesel",
          price_cpl: price,
        });
        if (error) console.error(`Insert ${b.name} error:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, date: today, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});