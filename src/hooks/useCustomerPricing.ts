import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "./useDemo";
import { getDemoData } from "@/data/demoData";

export interface CustomerPricing {
  id: string;
  client_account_id: number;
  margin_percent: number;
  payment_terms: string;
  weekly_volume_tier: string;
  min_litres: number;
  max_litres: number | null;
  pricing_type: string; // "margin" | "markup"
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const VOLUME_TIERS = [
  "0-500",
  "500-1,000",
  "1,000-2,000",
  "2,000-3,500",
  "3,500-5,000",
  "5,000-7,500",
  "7,500-10,000",
] as const;

export const PAYMENT_TERMS = [
  "Prepay",
  "7 days",
  "14 days",
  "21 days",
  "30 days",
  "60 days",
] as const;

export function useCustomerPricing() {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["customer-pricing", isDemo],
    queryFn: async () => {
      if (isDemo) {
        return getDemoData().customerPricing;
      }
      const { data, error } = await supabase
        .from("customer_pricing")
        .select("*")
        .order("client_account_id")
        .order("min_litres", { ascending: true });
      if (error) throw error;
      return (data || []) as CustomerPricing[];
    },
  });
}

export function useInsertCustomerPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      pricing: Omit<CustomerPricing, "id" | "created_at" | "updated_at">
    ) => {
      const payload = { ...pricing, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("customer_pricing")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-pricing"] }),
  });
}

export function useUpdateCustomerPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      pricing: Partial<CustomerPricing> & { id: string }
    ) => {
      const { id, ...rest } = pricing;
      const payload = { ...rest, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("customer_pricing")
        .update(payload as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-pricing"] }),
  });
}

// Keep backward compat alias
export function useUpsertCustomerPricing() {
  return useInsertCustomerPricing();
}

export function useDeleteCustomerPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_pricing").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-pricing"] }),
  });
}

/** Find the right tier for a given weekly volume */
export function findTierForVolume(
  tiers: CustomerPricing[],
  clientAccountId: number,
  weeklyLitres?: number
): CustomerPricing | null {
  const clientTiers = tiers
    .filter((t) => t.client_account_id === clientAccountId)
    .sort((a, b) => a.min_litres - b.min_litres);
  if (clientTiers.length === 0) return null;
  if (weeklyLitres === undefined) return clientTiers[0]; // default to first tier
  // Find the matching tier
  for (let i = clientTiers.length - 1; i >= 0; i--) {
    if (weeklyLitres >= clientTiers[i].min_litres) return clientTiers[i];
  }
  return clientTiers[0];
}

export function getBlendedMargin(pricingList: CustomerPricing[]): number {
  if (pricingList.length === 0) return 10;
  const sum = pricingList.reduce((s, p) => s + p.margin_percent, 0);
  return sum / pricingList.length;
}
