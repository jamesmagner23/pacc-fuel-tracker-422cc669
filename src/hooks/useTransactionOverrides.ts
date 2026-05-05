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

export class RegoConflictError extends Error {
  placa: string | null;
  count: number;
  names: string[];
  constructor(placa: string | null, count: number, names: string[]) {
    super("Rego conflict — tag blocked");
    this.name = "RegoConflictError";
    this.placa = placa;
    this.count = count;
    this.names = names;
  }
}

/**
 * Upsert a single transaction override via the `tag_transaction_with_feedback`
 * RPC. Returns rich feedback (plant name, backfill count, conflict flag) so
 * callers can render a precise confirmation toast for drivers.
 *
 * Before saving, we call `check_plant_rego_conflict` for the target plant
 * item. If the rego is active on more than one plant item, we **block** the
 * tag entirely and surface a driver-facing warning toast asking an admin to
 * fix the duplicate rego on the plant item record.
 */
export function useUpsertTransactionOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transaction_id: number;
      plant_item_id?: string | null;
      project_id?: string | null;
      notes?: string | null;
      /** When true, tag only this delivery — never auto-backfill siblings sharing the placa. */
      single?: boolean;
    }): Promise<TagFeedback> => {
      // Pre-check: block tagging if the target plant item shares a rego with
      // another active plant item. This prevents bad auto-backfill and forces
      // an admin to resolve the conflict first.
      if (input.plant_item_id && !input.single) {
        const { data: check, error: checkErr } = await supabase.rpc(
          "check_plant_rego_conflict",
          { _plant_item_id: input.plant_item_id }
        );
        if (checkErr) throw checkErr;
        const c = (check || {}) as any;
        if (c.conflict) {
          throw new RegoConflictError(
            c.placa ?? null,
            Number(c.count ?? 0),
            Array.isArray(c.names) ? c.names : []
          );
        }
      }

      const rpcName = input.single ? "tag_transaction_single" : "tag_transaction_with_feedback";
      const { data, error } = await supabase.rpc(rpcName as any, {
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
            "⚠ Rego is on multiple active plant items — auto-backfill skipped. Ask an admin to fix the duplicate rego on the plant item.",
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
    onError: (e: any) => {
      if (e instanceof RegoConflictError) {
        const others = (e.names || []).slice(0, 3).join(", ");
        toast({
          title: "⚠ Tag blocked — rego conflict",
          description:
            `Rego ${e.placa ?? ""} is active on ${e.count} plant items` +
            (others ? ` (${others}${e.count > 3 ? ", …" : ""})` : "") +
            ". Ask an admin to clear or change the duplicate rego on one of the plant items before tagging.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    },
  });
}

/**
 * Clears every auto-backfilled override (notes = 'Auto-tagged by placa match')
 * pointing at a given plant item. Manual tags are preserved.
 */
export function useClearAutoBackfillForPlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plant_item_id: string) => {
      const { data, error } = await supabase.rpc("clear_auto_backfill_for_plant", {
        _plant_item_id: plant_item_id,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["transaction-overrides"] });
      qc.invalidateQueries({ queryKey: ["customer-tx-overrides"] });
      toast({
        title: count > 0 ? `Cleared ${count} auto-tagged deliver${count === 1 ? "y" : "ies"}` : "Nothing to clear",
        description: count > 0 ? "Manual tags were preserved." : undefined,
      });
    },
    onError: (e: any) =>
      toast({ title: "Clear failed", description: e.message, variant: "destructive" }),
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