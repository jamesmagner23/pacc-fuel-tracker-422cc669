import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AIP_PAGE = "https://www.aip.com.au/pricing/retail-diesel";
const PROXY = `https://r.jina.ai/${AIP_PAGE}`;

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function toIso(day: string, monStr: string, year: string): string {
  const m = MONTHS[monStr.slice(0, 3).toLowerCase()] || "01";
  return `${year}-${m}-${day.padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const records: Array<{
      price_date: string;
      source: string;
      location: string;
      product: string;
      price_inc_gst: number;
      notes: string;
    }> = [];

    // AIP weekly retail diesel — Melbourne row
    try {
      const res = await fetch(PROXY, { headers: { Accept: "text/markdown" } });
      if (res.ok) {
        const md = await res.text();
        const dateRe = /Week Ending\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/gi;
        const dates: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = dateRe.exec(md)) !== null) {
          dates.push(toIso(m[1], m[2], m[3]));
        }

        for (const line of md.split("\n")) {
          if (!line.includes("|")) continue;
          if (!/melbourne/i.test(line)) continue;
          const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
          const nums = cells
            .slice(1)
            .map((c) => parseFloat(c.replace(/[^0-9.]/g, "")))
            .filter((n) => Number.isFinite(n) && n > 50 && n < 400);
          for (let i = 0; i < Math.min(nums.length, dates.length); i++) {
            records.push({
              price_date: dates[i],
              source: "AIP_Retail",
              location: "Melbourne",
              product: "Diesel",
              price_inc_gst: nums[i],
              notes: "AIP weekly retail diesel average",
            });
          }
          break;
        }
      }
    } catch (e) {
      console.error("AIP retail fetch failed:", e);
    }

    let upserted = 0;
    if (records.length > 0) {
      for (const r of records) {
        await supabase
          .from("retail_bowser_prices")
          .delete()
          .eq("price_date", r.price_date)
          .eq("source", r.source)
          .eq("location", r.location)
          .eq("product", r.product);
      }
      const { error } = await supabase.from("retail_bowser_prices").insert(records);
      if (error) throw error;
      upserted = records.length;
    }

    return new Response(
      JSON.stringify({ success: true, upserted, sources: ["AIP_Retail"] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("fetch-retail-bowser error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});