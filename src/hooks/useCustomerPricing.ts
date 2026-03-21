import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerPricing {
  id: string;
  client_account_id: number;
  margin_percent: number;
  payment_terms: string;
  weekly_volume_tier: string;
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
  return useQuery({
    queryKey: ["customer-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pricing")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CustomerPricing[];
    },
  });
}

export function useUpsertCustomerPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      pricing: Omit<CustomerPricing, "id" | "created_at" | "updated_at"> & { id?: string }
    ) => {
      const payload = { ...pricing, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("customer_pricing")
        .upsert(payload, { onConflict: "client_account_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-pricing"] }),
  });
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

export function getBlendedMargin(pricingList: CustomerPricing[]): number {
  if (pricingList.length === 0) return 10; // default fallback
  const sum = pricingList.reduce((s, p) => s + p.margin_percent, 0);
  return sum / pricingList.length;
}
