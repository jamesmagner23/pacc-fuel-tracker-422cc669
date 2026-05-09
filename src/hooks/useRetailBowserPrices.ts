import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RetailBowserPrice {
  id: string;
  price_date: string;
  source: string;
  location: string;
  product: string;
  price_inc_gst: number;
  sample_size: number | null;
  notes: string | null;
}

export function useRetailBowserPrices(days = 90, location = "Melbourne") {
  return useQuery({
    queryKey: ["retail-bowser", location, days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from("retail_bowser_prices")
        .select("*")
        .eq("location", location)
        .gte("price_date", since.toISOString().slice(0, 10))
        .order("price_date", { ascending: true });
      if (error) throw error;
      return (data || []) as RetailBowserPrice[];
    },
  });
}

export function useDriverIntakeAvg(days = 90) {
  return useQuery({
    queryKey: ["driver-intake-avg", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from("fuel_intake_logs")
        .select("log_date, bowser_retail_price")
        .gte("log_date", since.toISOString().slice(0, 10))
        .not("bowser_retail_price", "is", null)
        .order("log_date", { ascending: true });
      if (error) throw error;
      // Group by date, average price
      const byDate = new Map<string, { sum: number; count: number }>();
      for (const row of data || []) {
        const p = Number((row as { bowser_retail_price: number | null }).bowser_retail_price);
        if (!Number.isFinite(p)) continue;
        const d = (row as { log_date: string }).log_date;
        const cur = byDate.get(d) || { sum: 0, count: 0 };
        cur.sum += p;
        cur.count += 1;
        byDate.set(d, cur);
      }
      return Array.from(byDate.entries())
        .map(([date, v]) => ({ date, avg: v.sum / v.count, count: v.count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

export function useTriggerRetailBowser() {
  return async () => {
    const { data, error } = await supabase.functions.invoke("fetch-retail-bowser");
    if (error) throw error;
    return data;
  };
}

export function useTriggerBrandTGP() {
  return async () => {
    const { data, error } = await supabase.functions.invoke("fetch-brand-tgp");
    if (error) throw error;
    return data;
  };
}