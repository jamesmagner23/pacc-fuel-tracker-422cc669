import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

export interface BuyPrice {
  id: string;
  price_date: string;
  price_per_litre: number;
  supplier: string;
  notes: string | null;
  created_at: string;
}

// Fetch all buy prices ordered by date desc
export function useBuyPrices(days = 365) {
  const start = format(subDays(new Date(), days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["buy-prices", days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buy_prices")
        .select("*")
        .gte("price_date", start)
        .order("price_date", { ascending: false });
      if (error) throw error;
      return (data || []) as BuyPrice[];
    },
  });
}

// Fetch today's buy price
export function useTodayBuyPrice() {
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["buy-price-today", today],
    queryFn: async () => {
      const { data, error } = await supabase.from("buy_prices").select("*").eq("price_date", today).single();
      if (error && error.code !== "PGRST116") throw error;
      return data as BuyPrice | null;
    },
  });
}

// Upsert a buy price entry
export function useUpsertBuyPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { price_date: string; price_per_litre: number; supplier?: string; notes?: string }) => {
      const { data, error } = await supabase
        .from("buy_prices")
        .upsert({ ...entry, supplier: entry.supplier || "Pacific" }, { onConflict: "price_date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buy-prices"] });
      qc.invalidateQueries({ queryKey: ["buy-price-today"] });
    },
  });
}

// Delete a buy price entry
export function useDeleteBuyPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("buy_prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buy-prices"] });
      qc.invalidateQueries({ queryKey: ["buy-price-today"] });
    },
  });
}
