import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllTransactions } from "@/hooks/useTransactions";
import { CheckCircle2, AlertTriangle, ShieldAlert, RefreshCw } from "lucide-react";
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
  const { data: clientTxns = [], isFetching, refetch } = useAllTransactions();

  const { data: dbCounts } = useQuery({
    queryKey: ["data-health-counts"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const today = new Date();
      const out: Record<string, number> = {};

      // All-time count
      const all = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true });
      out.all = all.count ?? 0;

      // Per-range counts
      for (const r of RANGES) {
        if (r.days === null) continue;
        const start = format(subDays(today, r.days), "yyyy-MM-dd");
        const { count } = await supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .gte("date", start);
        out[r.key] = count ?? 0;
      }

      // Data quality flags
      const zeroRev = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .or("dinero_total.is.null,dinero_total.eq.0");
      out.zero_revenue = zeroRev.count ?? 0;

      const zeroLit = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .or("cantidad.is.null,cantidad.eq.0");
      out.zero_litres = zeroLit.count ?? 0;

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
          onClick={() => refetch()}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          Recheck
        </button>
      </div>

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
              ? "⚠ Truncation detected — dashboard is missing rows"
              : matched
                ? "All transactions loaded"
                : "Loading…"}
          </div>
          <div className="text-muted-foreground mt-0.5 tabular-nums">
            Fetched {fetched.toLocaleString()} of {dbAll?.toLocaleString() ?? "?"} rows in DB
            {truncated && (
              <>
                {" "}— short by{" "}
                <span className="font-semibold">
                  {(dbAll! - fetched).toLocaleString()}
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