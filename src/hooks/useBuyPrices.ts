import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { useDemo } from "./useDemo";
import { getDemoData } from "@/data/demoData";

export interface BuyPrice {
  id: string;
  price_date: string;
  price_per_litre: number;
  supplier: string;
  notes: string | null;
  created_at: string;
}

// Fetch all buy prices ordered by date desc
export const SUPPLIERS = ["Pacific", "Ampol"] as const;
export type SupplierName = typeof SUPPLIERS[number] | string;

export function useBuyPrices(days = 365) {
  const isDemo = useDemo();
  const start = format(subDays(new Date(), days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["buy-prices", days, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return getDemoData().buyPrices.filter(p => p.price_date >= start);
      }
      const { data, error } = await supabase
        .from("buy_prices")
        .select("*")
        .gte("price_date", start)
        .order("price_date", { ascending: false })
        .order("supplier", { ascending: true });
      if (error) throw error;
      return (data || []) as BuyPrice[];
    },
  });
}

// Fetch today's buy price for a specific supplier (defaults to Pacific)
export function useTodayBuyPrice(supplier: string = "Pacific") {
  const isDemo = useDemo();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["buy-price-today", today, supplier, isDemo],
    queryFn: async () => {
      if (isDemo) {
        const prices = getDemoData().buyPrices;
        return prices.find(p => p.price_date === today && p.supplier === supplier)
          || prices.find(p => p.price_date === today)
          || null;
      }
      const { data, error } = await supabase
        .from("buy_prices")
        .select("*")
        .eq("price_date", today)
        .eq("supplier", supplier)
        .maybeSingle();
      if (error) throw error;
      return data as BuyPrice | null;
    },
  });
}

// Fetch today's prices for all suppliers
export function useTodayBuyPrices() {
  const isDemo = useDemo();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["buy-prices-today-all", today, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return getDemoData().buyPrices.filter(p => p.price_date === today);
      }
      const { data, error } = await supabase
        .from("buy_prices")
        .select("*")
        .eq("price_date", today)
        .order("price_per_litre", { ascending: true });
      if (error) throw error;
      return (data || []) as BuyPrice[];
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
        .upsert({ ...entry, supplier: entry.supplier || "Pacific" }, { onConflict: "price_date,supplier" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buy-prices"] });
      qc.invalidateQueries({ queryKey: ["buy-price-today"] });
      qc.invalidateQueries({ queryKey: ["buy-prices-today-all"] });
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
