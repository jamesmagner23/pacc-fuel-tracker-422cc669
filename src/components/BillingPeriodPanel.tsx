import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Download, CalendarRange } from "lucide-react";
import { useAllTransactions } from "@/hooks/useTransactions";

type Period = { key: string; label: string; start: string; end: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Build the last N half-month invoicing periods (1st–15th, 16th–EOM), newest first. */
function buildPeriods(count = 12): Period[] {
  const now = new Date();
  const out: Period[] = [];
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-based
  let secondHalf = now.getDate() >= 16;

  for (let i = 0; i < count; i++) {
    const lastDay = new Date(y, m + 1, 0).getDate();
    const start = secondHalf ? 16 : 1;
    const end = secondHalf ? lastDay : 15;
    const startISO = `${y}-${pad(m + 1)}-${pad(start)}`;
    const endISO = `${y}-${pad(m + 1)}-${pad(end)}`;
    out.push({
      key: `${startISO}_${endISO}`,
      label: `${format(parseISO(startISO), "d")}–${format(parseISO(endISO), "d MMM yyyy")}`,
      start: startISO,
      end: endISO,
    });
    if (secondHalf) {
      secondHalf = false;
    } else {
      secondHalf = true;
      m -= 1;
      if (m < 0) { m = 11; y -= 1; }
    }
  }
  return out;
}

export function BillingPeriodPanel() {
  const { data: txns = [], isLoading } = useAllTransactions();
  const periods = useMemo(() => buildPeriods(12), []);
  const [periodKey, setPeriodKey] = useState(periods[0].key);
  const period = periods.find((p) => p.key === periodKey) || periods[0];
  const prevPeriod = periods[periods.findIndex((p) => p.key === period.key) + 1];

  const inPeriod = (p: Period | undefined) =>
    !p ? [] : txns.filter((t: any) => t.date && t.date >= p.start && t.date <= p.end);

  const rows = useMemo(() => {
    const map: Record<string, { litres: number; revenue: number; drops: number }> = {};
    inPeriod(period).forEach((t: any) => {
      const k = t.nombre_cliente1 || t.estacion || "Unassigned";
      if (!map[k]) map[k] = { litres: 0, revenue: 0, drops: 0 };
      map[k].litres += t.cantidad || 0;
      map[k].revenue += t.dinero_total || 0;
      map[k].drops += 1;
    });
    return Object.entries(map)
      .map(([customer, v]) => ({ customer, ...v }))
      .sort((a, b) => b.litres - a.litres);
  }, [txns, period]);

  const totalLitres = rows.reduce((s, r) => s + r.litres, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalDrops = rows.reduce((s, r) => s + r.drops, 0);
  const prevLitres = useMemo(
    () => inPeriod(prevPeriod).reduce((s: number, t: any) => s + (t.cantidad || 0), 0),
    [txns, prevPeriod],
  );
  const litresPct = prevLitres > 0 ? ((totalLitres - prevLitres) / prevLitres) * 100 : null;

  const downloadCsv = () => {
    const lines = [
      ["Customer", "Litres", "Deliveries", "Revenue (inc GST)"].join(","),
      ...rows.map((r) =>
        [
          `"${r.customer.replace(/"/g, '""')}"`,
          r.litres.toFixed(2),
          r.drops,
          r.revenue.toFixed(2),
        ].join(","),
      ),
      ["TOTAL", totalLitres.toFixed(2), totalDrops, totalRevenue.toFixed(2)].join(","),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pacc-invoice-volumes-${period.start}_to_${period.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card border border-border rounded-[14px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Invoicing period volumes</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground"
          >
            {periods.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={rows.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {[
          { label: "Litres", value: `${Math.round(totalLitres).toLocaleString()} L` },
          { label: "Revenue", value: `$${Math.round(totalRevenue).toLocaleString()}` },
          { label: "Deliveries", value: totalDrops.toLocaleString() },
          { label: "Customers", value: rows.length.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded-[10px] border border-border bg-muted/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[12px] text-muted-foreground">
        {period.start} → {period.end}
        {litresPct != null && (
          <> · {litresPct >= 0 ? "+" : ""}{litresPct.toFixed(1)}% litres vs previous period</>
        )}
      </div>

      <div className="mt-4 max-h-[320px] overflow-y-auto">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No deliveries in this period.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-card">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium py-2">Customer</th>
                <th className="text-right font-medium py-2">Litres</th>
                <th className="text-right font-medium py-2">Drops</th>
                <th className="text-right font-medium py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customer} className="border-t border-border">
                  <td className="py-2 pr-2 text-foreground truncate max-w-[220px]">{r.customer}</td>
                  <td className="py-2 text-right tabular-nums font-semibold text-foreground">{Math.round(r.litres).toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{r.drops}</td>
                  <td className="py-2 text-right tabular-nums text-foreground">${Math.round(r.revenue).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
