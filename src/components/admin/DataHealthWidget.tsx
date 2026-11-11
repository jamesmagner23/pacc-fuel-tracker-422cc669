import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllTransactions } from "@/hooks/useTransactions";
import { CheckCircle2, AlertTriangle, ShieldAlert, RefreshCw } from "lucide-react";
import { withTimeout } from "@/lib/requestTimeout";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";

type RangeDef = { key: string; label: string; days: number | null };

const RANGES: RangeDef[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

/**
 * Verifies that what the dashboard renders matches what's actually in the
 * `transactions` table. Compares:
 *   - DB-side count (head: true, count: 'exact') vs client-side fetched length.
 *   - Per-range coverage (deliveries, litres, missing values).
 * Flags any truncation (e.g. Supabase 1000-row cap) and zero-revenue rows.
 */
export default function DataHealthWidget() {
  const { data: clientTxns = [], isFetching, refetch, error: rowsError } = useAllTransactions();

  const { data: dbCounts, error: countsError, refetch: refetchCounts } = useQuery({
    queryKey: ["data-health-counts"],
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const today = new Date();
      const out: Record<string, number> = {};

      const specs = [
        ...RANGES.map(r => ({ key: r.key, start: r.days == null ? null : format(subDays(today, r.days), "yyyy-MM-dd"), field: null as string | null })),
        { key: "zero_revenue", start: null, field: "dinero_total" },
        { key: "zero_litres", start: null, field: "cantidad" },
      ];
      await Promise.all(specs.map(async spec => {
        let query = supabase.from("transactions").select("id", { count: "exact", head: true });
        if (spec.start) query = query.gte("date", spec.start);
        if (spec.field) query = query.or(`${spec.field}.is.null,${spec.field}.eq.0`);
        const { count, error } = await withTimeout(query);
        if (error) throw error;
        out[spec.key] = count ?? 0;
      }));
      return out;
    },
  });

  const dbAll = dbCounts?.all ?? null;
  const fetched = clientTxns.length;
  const truncated = dbAll !== null && fetched > 0 && fetched < dbAll;
  const matched = dbAll !== null && fetched === dbAll;

  return (
    <div className="bg-surface border border-surface-border rounded-[10px] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" />
          Data Health
        </h2>
        <button
          onClick={() => { void refetch(); void refetchCounts(); }}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          Recheck
        </button>
      </div>

      {(countsError || rowsError) && <div className="text-warning text-sm">Data health could not be loaded. <Button variant="outline" size="sm" onClick={() => { void refetch(); void refetchCounts(); }}>Retry</Button></div>}
      {/* Headline: load integrity */}
      <div
        className={`rounded-md border p-3 text-xs flex items-start gap-2 ${
          truncated
            ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
            : matched
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-border bg-card/40"
        }`}
      >
        {truncated ? (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
        )}
        <div className="flex-1">
          <div className="font-semibold">
            {truncated
              ? "Truncation detected, dashboard is missing rows"
              : matched
                ? dbAll === 0 ? "No transactions found" : "All transactions loaded"
                : countsError || rowsError ? "Unable to check data" : "Loading…"}
          </div>
          <div className="text-muted-foreground mt-0.5 tabular-nums">
            Fetched {fetched.toLocaleString()} of {dbAll?.toLocaleString() ?? "?"} rows in DB
            {truncated && (
              <>
                {" "}short by{" "}
                <span className="font-semibold">
                  {((dbAll ?? 0) - fetched).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Range coverage */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Range Coverage (DB count)
        </div>
        <div className="space-y-1.5 text-xs">
          {RANGES.map((r) => (
            <div key={r.key} className="flex justify-between items-baseline">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold tabular-nums">
                {dbCounts ? (dbCounts[r.key] ?? 0).toLocaleString() : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quality flags */}
      <div className="border-t border-border pt-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Quality Flags
        </div>
        <div className="space-y-1.5 text-xs">
          <FlagRow
            label="Rows with zero / null revenue"
            value={dbCounts?.zero_revenue}
            total={dbAll}
            warnAtPct={50}
          />
          <FlagRow
            label="Rows with zero / null litres"
            value={dbCounts?.zero_litres}
            total={dbAll}
            warnAtPct={5}
          />
        </div>
      </div>
    </div>
  );
}

function FlagRow({
  label,
  value,
  total,
  warnAtPct,
}: {
  label: string;
  value: number | undefined;
  total: number | null;
  warnAtPct: number;
}) {
  if (value === undefined || total === null) {
    return (
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span>—</span>
      </div>
    );
  }
  const pct = total > 0 ? (value / total) * 100 : 0;
  const warn = pct >= warnAtPct;
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-semibold tabular-nums ${
          warn ? "text-destructive" : value > 0 ? "text-amber-400" : "text-emerald-400"
        }`}
      >
        {value.toLocaleString()} ({pct.toFixed(1)}%)
      </span>
    </div>
  );
}