import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2, ShieldCheck, EyeOff, Eraser } from "lucide-react";
import { toast } from "sonner";

interface ConflictPlantItem {
  id: string;
  name: string;
  client_account_id: number;
  equipment_type: string | null;
  placa: string;
}

interface ConflictGroup {
  placa: string;
  plant_items: ConflictPlantItem[];
}

function useRegoConflicts() {
  return useQuery({
    queryKey: ["rego-conflicts"],
    queryFn: async (): Promise<ConflictGroup[]> => {
      const { data, error } = await supabase.rpc("list_rego_conflicts");
      if (error) throw error;
      return (data || []) as ConflictGroup[];
    },
  });
}

function useClientNames(ids: number[]) {
  const unique = Array.from(new Set(ids));
  return useQuery({
    queryKey: ["client-names", unique.sort().join(",")],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name")
        .in("id", unique);
      if (error) throw error;
      const m: Record<number, string> = {};
      (data || []).forEach((c: any) => (m[c.id] = c.company_name));
      return m;
    },
  });
}

export default function RegoConflicts() {
  const qc = useQueryClient();
  const { data: groups = [], isLoading } = useRegoConflicts();

  const allClientIds = useMemo(
    () => groups.flatMap((g) => g.plant_items.map((p) => p.client_account_id)),
    [groups]
  );
  const { data: clientNames = {} } = useClientNames(allClientIds);

  const [busy, setBusy] = useState<string | null>(null);

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      setBusy(id);
      const { error } = await supabase
        .from("plant_items")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plant item deactivated");
      qc.invalidateQueries({ queryKey: ["rego-conflicts"] });
      qc.invalidateQueries({ queryKey: ["plant-items"] });
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  const clearPlaca = useMutation({
    mutationFn: async (id: string) => {
      setBusy(id);
      const { error } = await supabase
        .from("plant_items")
        .update({ placa: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rego cleared");
      qc.invalidateQueries({ queryKey: ["rego-conflicts"] });
      qc.invalidateQueries({ queryKey: ["plant-items"] });
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      <header className="card p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-accent" />
          <h1 className="text-lg font-bold text-foreground m-0">Rego Conflicts</h1>
        </div>
        <p className="text-xs text-muted-foreground m-0">
          When the same rego (placa) is assigned to more than one active plant
          item, the system will not auto-tag transactions for that rego —
          drivers must tag each delivery manually until the conflict is
          resolved. Resolve by deactivating one plant item or clearing its
          rego.
        </p>
      </header>

      {isLoading ? (
        <div className="text-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Scanning for conflicts…</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="card p-10 text-center">
          <ShieldCheck className="w-8 h-8 text-accent mx-auto mb-3" />
          <p className="text-md text-foreground m-0 font-semibold">No rego conflicts</p>
          <p className="text-xs text-muted-foreground mt-1">
            Every active plant item has a unique rego. Auto-tagging will
            proceed normally.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.placa} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="kpi-label mb-0.5">Rego</p>
                  <p className="text-base font-bold text-foreground font-mono">
                    {g.placa}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-destructive/15 text-destructive font-semibold">
                  {g.plant_items.length} conflicts
                </span>
              </div>

              <div className="border border-surface-border rounded-md overflow-hidden">
                {g.plant_items.map((pi, i) => (
                  <div
                    key={pi.id}
                    className={`px-3 py-2.5 flex items-center gap-3 ${
                      i > 0 ? "border-t border-surface-border" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {pi.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {clientNames[pi.client_account_id] ||
                          `Client #${pi.client_account_id}`}
                        {pi.equipment_type ? ` · ${pi.equipment_type}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => clearPlaca.mutate(pi.id)}
                      disabled={busy === pi.id}
                      className="text-[11px] font-semibold uppercase tracking-wider rounded px-2.5 py-1.5 border border-surface-border text-foreground bg-transparent flex items-center gap-1.5 disabled:opacity-50"
                      style={{ minHeight: 36 }}
                    >
                      <Eraser className="w-3 h-3" />
                      Clear rego
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Deactivate "${pi.name}"? It will no longer receive auto-tagged deliveries.`
                          )
                        ) {
                          deactivate.mutate(pi.id);
                        }
                      }}
                      disabled={busy === pi.id}
                      className="text-[11px] font-semibold uppercase tracking-wider rounded px-2.5 py-1.5 bg-destructive text-destructive-foreground flex items-center gap-1.5 disabled:opacity-50"
                      style={{ minHeight: 36 }}
                    >
                      <EyeOff className="w-3 h-3" />
                      Deactivate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}