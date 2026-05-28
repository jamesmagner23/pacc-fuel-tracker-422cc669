import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useDispatchStops, type DispatchStop } from "@/hooks/useDispatch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatTime } from "@/lib/format";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function useClientNameMap() {
  return useQuery({
    queryKey: ["client-account-name-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_accounts")
        .select("id, company_name")
        .eq("is_active", true);
      const map: Record<number, string> = {};
      (data || []).forEach((c: any) => { map[c.id] = c.company_name; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

function sortStops(stops: DispatchStop[]): DispatchStop[] {
  const upcoming = stops.filter((s) => s.status === "scheduled" || s.status === "in_progress");
  const done = stops.filter((s) => s.status === "completed");
  const cancelled = stops.filter((s) => s.status === "cancelled");
  upcoming.sort((a, b) => a.sequence - b.sequence);
  done.sort((a, b) => {
    const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return tb - ta;
  });
  return [...upcoming, ...done, ...cancelled];
}

function StatusBadge({ stop }: { stop: DispatchStop }) {
  if (stop.status === "in_progress") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
        style={{ background: "#FFF4D9", color: "#7A5300" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        EN ROUTE
      </span>
    );
  }
  if (stop.status === "completed") {
    const t = stop.completed_at ? formatTime(stop.completed_at) : "";
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
        style={{ background: "#E6F3E1", color: "#2A6A2E" }}
      >
        COMPLETED{t ? ` · ${t}` : ""}
      </span>
    );
  }
  if (stop.status === "cancelled") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground">
        CANCELLED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-muted text-foreground">
      SCHEDULED
    </span>
  );
}

export function TodaysDeliveriesPanel({ heightClass = "h-[440px]" }: { heightClass?: string }) {
  const today = todayISO();
  const { data: stops = [], isLoading } = useDispatchStops(today);
  const { data: clientMap = {} } = useClientNameMap();

  const rows = useMemo(() => sortStops(stops).slice(0, 8), [stops]);

  return (
    <div className={`bg-card text-foreground border border-border rounded-xl flex flex-col ${heightClass}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-base font-semibold text-foreground">Today's deliveries</h2>
        <Link to="/dispatch" className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
          View all →
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12 gap-3">
            <div className="text-base font-semibold text-foreground">No deliveries scheduled for today</div>
            <div className="text-sm text-muted-foreground">Plan stops in Dispatch to populate this view.</div>
            <Link
              to="/dispatch"
              className="inline-flex items-center rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              Open Dispatch
            </Link>
          </div>
        ) : (
          <ul>
            {rows.map((s) => {
              const customer = clientMap[s.client_account_id] || s.site_name || "—";
              const delivered = s.delivered_litres;
              const estimated = s.estimated_litres;
              const showLitres = delivered ?? (s.status === "scheduled" || s.status === "in_progress" ? estimated : null);
              const isEstimate = delivered == null && showLitres != null;
              return (
                <li key={s.id} className="border-b border-border last:border-b-0">
                  <Link
                    to={`/transactions?date=${s.scheduled_date}&q=${encodeURIComponent(customer)}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3 hover:bg-muted/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{customer}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.address || s.site_name || "—"}
                      </div>
                    </div>
                    <div className="text-sm font-medium tabular-nums text-foreground w-[90px] text-right">
                      {showLitres != null
                        ? `${isEstimate ? "~" : ""}${showLitres.toLocaleString()} L`
                        : "—"}
                    </div>
                    <div className="w-[120px] flex justify-end">
                      <StatusBadge stop={s} />
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