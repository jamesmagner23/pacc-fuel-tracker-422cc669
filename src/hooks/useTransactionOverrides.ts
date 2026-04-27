import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface TransactionOverride {
  transaction_id: number;
  plant_item_id: string | null;
  project_id: string | null;
  notes: string | null;
  set_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch overrides for a given list of transaction ids.
 * Returns an object keyed by transaction_id for easy lookup.
 */
export function useTransactionOverrides(transactionIds: number[] | undefined) {
  const ids = Array.from(new Set((transactionIds || []).filter((n) => Number.isFinite(n))));
  return useQuery({
    queryKey: ["transaction-overrides", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_overrides")
        .select("*")
        .in("transaction_id", ids);
      if (error) throw error;
      const map: Record<number, TransactionOverride> = {};
      (data || []).forEach((o: any) => {
        map[o.transaction_id] = o as TransactionOverride;
      });
      return map;
    },
  });
}

/** Upsert (create or update) a single transaction override. */
export function useUpsertTransactionOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transaction_id: number;
      plant_item_id?: string | null;
      project_id?: string | null;
      notes?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        transaction_id: input.transaction_id,
        plant_item_id: input.plant_item_id ?? null,
        project_id: input.project_id ?? null,
        notes: input.notes ?? null,
        set_by: user?.id ?? null,
      };
      const { error } = await supabase
        .from("transaction_overrides")
        .upsert(payload, { onConflict: "transaction_id" });
      if (error) throw error;
      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transaction-overrides"] });
      toast({ title: "Delivery tagged" });
    },
    onError: (e: any) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}

/** Remove an override entirely (revert to placa-based inheritance). */
export function useDeleteTransactionOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transaction_id: number) => {
      const { error } = await supabase
        .from("transaction_overrides")
        .delete()
        .eq("transaction_id", transaction_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transaction-overrides"] });
      toast({ title: "Tag cleared" });
    },
    onError: (e: any) =>
      toast({ title: "Clear failed", description: e.message, variant: "destructive" }),
  });
}