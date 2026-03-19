import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BuyPrice {
  id: string;
  price_date: string;
  price_per_litre: number;
  supplier: string | null;
  notes: string | null;
  created_at: string | null;
}

export function useBuyPrices() {
  return useQuery({
    queryKey: ["buy-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buy_prices")
        .select("*")
        .order("price_date", { ascending: false });

      if (error) throw error;
      return (data || []) as BuyPrice[];
    },
  });
}

export function useLatestBuyPrice() {
  return useQuery({
    queryKey: ["buy-price-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buy_prices")
        .select("*")
        .order("price_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as BuyPrice | null;
    },
  });
}

export function useUpsertBuyPrice() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (row: {
      price_date: string;
      price_per_litre: number;
      supplier?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("buy_prices")
        .upsert(row, { onConflict: "price_date" })
        .select()
        .single();

      if (error) throw error;
      return data as BuyPrice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buy-prices"] });
      qc.invalidateQueries({ queryKey: ["buy-price-latest"] });
    },
  });
}
