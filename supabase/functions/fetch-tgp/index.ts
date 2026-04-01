import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AIP_URL = "http://api.aip.com.au/public/tgpTables";

const CITIES = [
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Adelaide",
  "Perth",
  "Darwin",
  "Hobart",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch AIP TGP page
    const response = await fetch(AIP_URL);
    if (!response.ok) {
      throw new Error(`AIP fetch failed: ${response.status}`);
    }
    const html = await response.text();

    // Parse dates from headers - they contain <br/> tags like "Thursday<br/>26 March 2026"
    const headerRegex =
      /<th[^>]*>\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*(?:<br\s*\/?>)\s*(\d{1,2}\s+\w+\s+\d{4})\s*<\/th>/gi;
    const allDateMatches: string[] = [];
    let match;
    while ((match = headerRegex.exec(html)) !== null) {
      allDateMatches.push(match[1].trim());
    }

    // First set of dates = ULP, second set = Diesel (both same dates)
    const numDates = allDateMatches.length / 2;
    const dates = allDateMatches.slice(0, numDates);

    // Parse date strings to YYYY-MM-DD
    const parsedDates = dates.map((d) => {
      const parts = d.split(/\s+/);
      const day = parts[0].padStart(2, "0");
      const monthNames: Record<string, string> = {
        January: "01", February: "02", March: "03", April: "04",
        May: "05", June: "06", July: "07", August: "08",
        September: "09", October: "10", November: "11", December: "12",
      };
      const month = monthNames[parts[1]] || "01";
      const year = parts[2];
      return `${year}-${month}-${day}`;
    });

    // Parse table rows
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    const rows: string[][] = [];
    while ((match = rowRegex.exec(html)) !== null) {
      const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gis;
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(match[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length > 0) rows.push(cells);
    }

    // Rows 1-7 are ULP cities, 9-15 are Diesel cities
    const records: Array<{
      price_date: string;
      location: string;
      product: string;
      price_cpl: number;
      source: string;
    }> = [];

    for (let cityIdx = 0; cityIdx < CITIES.length; cityIdx++) {
      // ULP row index = cityIdx + 1 (row 0 is header)
      const ulpRow = rows[cityIdx + 1];
      // Diesel row index = cityIdx + 1 + 7 + 1 (skip 7 ULP rows + 1 diesel header)
      const dieselRow = rows[cityIdx + 1 + 7 + 1];

      if (ulpRow) {
        for (let dateIdx = 0; dateIdx < parsedDates.length; dateIdx++) {
          const val = parseFloat(ulpRow[dateIdx + 1]);
          if (!isNaN(val)) {
            records.push({
              price_date: parsedDates[dateIdx],
              location: CITIES[cityIdx],
              product: "ULP",
              price_cpl: val,
              source: "AIP",
            });
          }
        }
      }

      if (dieselRow) {
        for (let dateIdx = 0; dateIdx < parsedDates.length; dateIdx++) {
          const val = parseFloat(dieselRow[dateIdx + 1]);
          if (!isNaN(val)) {
            records.push({
              price_date: parsedDates[dateIdx],
              location: CITIES[cityIdx],
              product: "Diesel",
              price_cpl: val,
              source: "AIP",
            });
          }
        }
      }
    }

    // Upsert into terminal_gate_prices
    if (records.length > 0) {
      const { error } = await supabase
        .from("terminal_gate_prices")
        .upsert(records, { onConflict: "price_date,location,product" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        records_upserted: records.length,
        dates: parsedDates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("TGP fetch error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
