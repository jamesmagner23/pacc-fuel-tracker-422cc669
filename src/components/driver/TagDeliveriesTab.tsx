import { useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Tag as TagIcon, X } from "lucide-react";
import { toast } from "sonner";
import {
  useTransactionOverrides,
  useUpsertTransactionOverride,
  useDeleteTransactionOverride,
} from "@/hooks/useTransactionOverrides";
import { TagDeliveryModal } from "./TagDeliveryModal";

/** Fetches the last N days of transactions visible to the driver. */
function useRecentTransactions(days = 30) {
  const fromDate = format(subDays(new Date(), days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["driver-recent-transactions", fromDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, fecha, date, nombre_cliente1, placa, cantidad, factura"
        )
        .gte("fecha", `${fromDate}T00:00:00`)
        .order("fecha", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
}

/** Fetches every client account so the driver can scope plant/projects. */
function useAllClientAccounts() {
  return useQuery({
    queryKey: ["driver-client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, speedsol_names")
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });
}

type FilterMode = "all" | "untagged";

export function TagDeliveriesTab() {
  const [filter, setFilter] = useState<FilterMode>("untagged");
  const [target, setTarget] = useState<any | null>(null);

  const { data: txns = [], isLoading } = useRecentTransactions(30);
  const { data: clients = [] } = useAllClientAccounts();

  const ids = useMemo(() => txns.map((t: any) => t.id as number), [txns]);
  const { data: overrides = {} } = useTransactionOverrides(ids);

  const clearOverride = useDeleteTransactionOverride();

  // Map speedsol name → client_account_id for quick scoping.
  const speedsolToClient = useMemo(() => {
    const m: Record<string, number> = {};
    clients.forEach((c: any) => {
      (c.speedsol_names || []).forEach((n: string) => (m[n] = c.id));
    });
    return m;
  }, [clients]);

  const visible = useMemo(() => {
    if (filter === "all") return txns;
    return txns.filter((t: any) => !overrides[t.id]);
  }, [txns, overrides, filter]);

  const taggedCount = txns.filter((t: any) => overrides[t.id]).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header / counters */}
      <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="kpi-label mb-0.5">Last 30 days</p>
          <p className="text-lg font-bold text-foreground">
            {taggedCount} / {txns.length} tagged
          </p>
        </div>
        <div
          className="flex gap-1 p-1 rounded-md"
          style={{
            background: "var(--surface, #142A16)",
            border: "1px solid var(--surface-border)",
          }}
        >
          {(
            [
              { k: "untagged", label: "Untagged" },
              { k: "all", label: "All" },
            ] as const
          ).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
              style={{
                background:
                  filter === k ? "var(--accent, #C8F26A)" : "transparent",
                color: filter === k ? "#fff" : "var(--text-secondary, #C7BFAC)",
                border: "none",
                cursor: "pointer",
                minHeight: 36,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading deliveries…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10">
          <TagIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-md text-muted-foreground m-0">
            {filter === "untagged"
              ? "Everything's tagged 🎉"
              : "No deliveries in the last 30 days."}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {visible.map((t: any, i: number) => {
            const ov = overrides[t.id];
            const placa = (t.placa || "").trim();
            const clientId = speedsolToClient[t.nombre_cliente1 || ""] ?? null;
            return (
              <div
                key={t.id}
                className="px-4 py-3 flex items-center gap-3 border-b border-surface-border last:border-0"
                style={{ minHeight: 64 }}
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {t.nombre_cliente1 || "Unknown"}
                    {placa && (
                      <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                        {placa}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.fecha
                      ? format(parseISO(t.fecha), "EEE dd MMM HH:mm")
                      : "—"}
                    {t.factura ? ` · #${t.factura}` : ""} ·{" "}
                    {(t.cantidad || 0).toLocaleString()}L
                  </div>
                  {ov && (
                    <div className="text-[10px] mt-0.5 text-accent">
                      Tagged
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {ov && (
                    <button
                      onClick={() => {
                        if (confirm("Remove tag from this delivery?")) {
                          clearOverride.mutate(t.id, {
                            onError: (e: any) => toast.error(e.message),
                          });
                        }
                      }}
                      title="Clear tag"
                      className="rounded border border-surface-border bg-transparent text-muted-foreground p-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setTarget({ ...t, _clientAccountId: clientId })
                    }
                    className="text-[11px] font-bold uppercase tracking-wider rounded px-3 py-2"
                    style={{
                      background: "var(--accent, #C8F26A)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      minHeight: 40,
                    }}
                  >
                    {ov ? "Edit" : "Tag"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TagDeliveryModal
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        transaction={target}
        clients={clients}
        currentOverride={target ? overrides[target.id] : undefined}
      />
    </div>
  );
}