import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Quote {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  volume_litres: number;
  buy_price_per_litre: number;
  margin_percent: number;
  sell_price_per_litre: number;
  total_ex_gst: number;
  total_inc_gst: number;
  notes: string | null;
  status: string;
  sent_at: string | null;
  valid_until: string | null;
  created_at: string;
}

export interface PricingTier {
  id: string;
  tier_name: string;
  min_litres: number;
  max_litres: number | null;
  margin_percent: number;
  created_at: string;
}

export function usePricingTiers() {
  return useQuery({
    queryKey: ["pricing-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_tiers")
        .select("*")
        .order("min_litres", { ascending: true });
      if (error) throw error;
      return (data || []) as PricingTier[];
    },
  });
}

export function useUpsertTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tier: Partial<PricingTier> & { tier_name: string; min_litres: number; margin_percent: number }) => {
      const { data, error } = await supabase.from("pricing_tiers").upsert(tier).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-tiers"] }),
  });
}

export function useDeleteTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pricing_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-tiers"] }),
  });
}

export function useQuotes() {
  return useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Quote[];
    },
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quote: Omit<Quote, "id" | "created_at" | "sent_at" | "status">) => {
      const { data, error } = await supabase.from("quotes").insert(quote).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<Quote> & { id: string }) => {
      const { error } = await supabase.from("quotes").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, sent_at }: { id: string; status: string; sent_at?: string }) => {
      const update: Record<string, unknown> = { status };
      if (sent_at) update.sent_at = sent_at;
      const { error } = await supabase.from("quotes").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function getTierForVolume(tiers: PricingTier[], volume: number): PricingTier | null {
  for (const tier of tiers) {
    if (volume >= tier.min_litres && (tier.max_litres === null || volume < tier.max_litres)) {
      return tier;
    }
  }
  return tiers[tiers.length - 1] || null;
}
