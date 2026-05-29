import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { formatTime } from "@/lib/format";

function txTime(t: Transaction): number {
  return t.fecha ? new Date(t.fecha).getTime() : 0;
}

export function TodaysDeliveriesPanel({ heightClass = "h-[440px]" }: { heightClass?: string }) {
  // Show actual SpeedSol deliveries (not dispatch plans). Prefer today's
  // fills; if none have synced yet, fall back to the most recent week so the
  // panel never sits empty when a sync runs after midnight.
  const { data: todayTx = [], isLoading: loadingToday } = useTransactions("today");
  const { data: weekTx = [], isLoading: loadingWeek } = useTransactions("week");
  const isLoading = loadingToday || loadingWeek;

  const rows = useMemo(() => {
    const src = todayTx.length > 0 ? todayTx : weekTx;
    return [...src].sort((a, b) => txTime(b) - txTime(a)).slice(0, 8);
  }, [todayTx, weekTx]);
  const usingFallback = todayTx.length === 0 && weekTx.length > 0;

  return (
    <div className={`bg-card text-foreground border border-border rounded-xl flex flex-col ${heightClass}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-base font-semibold text-foreground">
          {usingFallback ? "Recent deliveries" : "Today's deliveries"}
        </h2>
        <Link to="/transactions" className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
          View all →
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12 gap-3">
            <div className="text-base font-semibold text-foreground">No deliveries yet</div>
            <div className="text-sm text-muted-foreground">Recent SpeedSol fills will appear here as soon as they sync.</div>
          </div>
        ) : (
          <ul>
            {rows.map((t) => {
              const customer = t.nombre_cliente1 || t.estacion || "—";
              const litres = t.cantidad ?? null;
              const when = t.fecha ? formatTime(t.fecha) : "";
              const site = t.producto || "—";
              return (
                <li key={t.id} className="border-b border-border last:border-b-0">
                  <Link
                    to={`/transactions?date=${t.date ?? ""}&q=${encodeURIComponent(customer)}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3 hover:bg-muted/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{customer}</div>
                      <div className="text-xs text-muted-foreground truncate">{site}</div>
                    </div>
                    <div className="text-sm font-medium tabular-nums text-foreground w-[90px] text-right">
                      {litres != null ? `${litres.toLocaleString()} L` : "—"}
                    </div>
                    <div className="w-[80px] text-right text-xs text-muted-foreground tabular-nums">
                      {when}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}