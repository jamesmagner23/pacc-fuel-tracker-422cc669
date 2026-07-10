import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export interface QuoteApprovalRequest {
  id: string;
  driver_id: string;
  customer_name: string;
  customer_email: string | null;
  litres: number;
  buy_price_per_litre: number;
  sell_price_per_litre: number;
  margin_pct: number;
  payment_terms_days: number | null;
  supplier: string | null;
  driver_note: string | null;
  breach_reasons: string[];
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useQuoteApprovals() {
  return useQuery({
    queryKey: ["quote-approvals"],
    queryFn: async (): Promise<QuoteApprovalRequest[]> => {
      const { data, error } = await supabase
        .from("quote_approval_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as QuoteApprovalRequest[];
    },
  });
}

export function usePendingApprovalCount() {
  const { data: role } = useUserRole();
  return useQuery({
    queryKey: ["quote-approvals-pending-count"],
    enabled: role === "admin",
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("quote_approval_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

export function useCreateApprovalRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<QuoteApprovalRequest, "id" | "driver_id" | "status" | "admin_note" | "decided_by" | "decided_at" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const { data, error } = await supabase
        .from("quote_approval_requests")
        .insert({ ...payload, driver_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-approvals"] });
      qc.invalidateQueries({ queryKey: ["quote-approvals-pending-count"] });
    },
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, admin_note }: { id: string; status: "approved" | "rejected"; admin_note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("quote_approval_requests")
        .update({
          status,
          admin_note: admin_note || null,
          decided_by: user?.id ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote-approvals"] });
      qc.invalidateQueries({ queryKey: ["quote-approvals-pending-count"] });
    },
  });
}

/** Shared guardrails for driver quoting. */
export const DRIVER_RULES = {
  minLitres: 2000,
  maxTermsDays: 14,
  minMarginPct: 20,
};

export function checkDriverBreaches(input: {
  litres: number;
  paymentTermsDays: number | null | undefined;
  marginPct: number;
}): string[] {
  const breaches: string[] = [];
  if (input.litres < DRIVER_RULES.minLitres) {
    breaches.push(`Volume ${input.litres.toLocaleString()} L is below the ${DRIVER_RULES.minLitres.toLocaleString()} L minimum for driver pricing.`);
  }
  if (input.paymentTermsDays == null || input.paymentTermsDays > DRIVER_RULES.maxTermsDays) {
    breaches.push(`Payment terms must be ≤ ${DRIVER_RULES.maxTermsDays} days (current: ${input.paymentTermsDays == null ? "not set" : input.paymentTermsDays + "d"}).`);
  }
  if (input.marginPct < DRIVER_RULES.minMarginPct) {
    breaches.push(`Margin ${input.marginPct.toFixed(1)}% is below the ${DRIVER_RULES.minMarginPct}% floor.`);
  }
  return breaches;
}