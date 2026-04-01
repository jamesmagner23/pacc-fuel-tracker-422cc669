import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useDemo } from "./useDemo";
import { getDemoData } from "@/data/demoData";

export interface TerminalGatePrice {
  id: string;
  price_date: string;
  location: string;
  product: string;
  price_cpl: number;
  price_per_litre: number;
  source: string;
  created_at: string;
}

export function useTGPrices(location = "Melbourne", product = "Diesel", days = 30) {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["tgp", location, product, days, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return getDemoData().tgp.slice(0, days);
      }
      const { data, error } = await supabase
        .from("terminal_gate_prices")
        .select("*")
        .eq("location", location)
        .eq("product", product)
        .order("price_date", { ascending: false })
        .limit(days);
      if (error) throw error;
      return (data || []) as TerminalGatePrice[];
    },
  });
}

export function useTodayTGP(location = "Melbourne", product = "Diesel") {
  const isDemo = useDemo();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["tgp-today", location, product, today, isDemo],
    queryFn: async () => {
      if (isDemo) {
        const tgp = getDemoData().tgp;
        return tgp.find(p => p.price_date === today) || tgp[0] || null;
      }
      const { data, error } = await supabase
        .from("terminal_gate_prices")
        .select("*")
        .eq("location", location)
        .eq("product", product)
        .eq("price_date", today)
        .maybeSingle();
      if (error) throw error;
      return data as TerminalGatePrice | null;
    },
  });
}

export function useFetchTGP() {
  return async () => {
    const { data, error } = await supabase.functions.invoke("fetch-tgp");
    if (error) throw error;
    return data;
  };
}
