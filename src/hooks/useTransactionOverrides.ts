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

export interface TagFeedback {
  plant_item_name: string | null;
  placa: string | null;
  backfill_count: number;
  conflict: boolean;
}

/**
 * Upsert a single transaction override via the `tag_transaction_with_feedback`
 * RPC. Returns rich feedback (plant name, backfill count, conflict flag) so
 * callers can render a precise confirmation toast for drivers.
 */
export function useUpsertTransactionOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transaction_id: number;
      plant_item_id?: string | null;
      project_id?: string | null;
      notes?: string | null;
    }): Promise<TagFeedback> => {
      const { data, error } = await supabase.rpc("tag_transaction_with_feedback", {
        _transaction_id: input.transaction_id,
        _plant_item_id: input.plant_item_id ?? null,
        _project_id: input.project_id ?? null,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      const r = (data || {}) as any;
      return {
        plant_item_name: r.plant_item_name ?? null,
        placa: r.placa ?? null,
        backfill_count: Number(r.backfill_count ?? 0),
        conflict: Boolean(r.conflict),
      };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["transaction-overrides"] });
      // Build a precise message; fall back to a generic one when no plant.
      if (!res.plant_item_name) {
        toast({ title: "Delivery tagged" });
        return;
      }
      let description = res.placa ? `Rego ${res.placa}` : undefined;
      if (res.conflict) {
        toast({
          title: `Tagged to ${res.plant_item_name}`,
          description:
            (description ? description + " · " : "") +
            "⚠ Rego is on multiple active plant items — auto-backfill skipped. Resolve in Admin › Rego Conflicts.",
          variant: "destructive",
        });
      } else if (res.backfill_count > 0) {
        toast({
          title: `Tagged to ${res.plant_item_name}`,
          description:
            (description ? description + " · " : "") +
            `Auto-backfilled ${res.backfill_count} matching deliver${
              res.backfill_count === 1 ? "y" : "ies"
            }.`,
        });
      } else {
        toast({
          title: `Tagged to ${res.plant_item_name}`,
          description,
        });
      }
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