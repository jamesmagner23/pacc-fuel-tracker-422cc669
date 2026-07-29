import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Download, CalendarRange, ArrowUp, ArrowDown } from "lucide-react";
import { useAllTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { buildBuyPriceLookup } from "@/lib/buyCost";

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

type Agg = { litres: number; cost: number; drops: number; revenue: number };
const EMPTY: Agg = { litres: 0, cost: 0, drops: 0, revenue: 0 };

function pctDelta(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

function DeltaChip({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct == null) return <span className="text-[11px] text-muted-foreground">no prior data</span>;
  const up = pct >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums " +
        (Math.abs(pct) < 0.05 ? "text-muted-foreground" : good ? "text-positive" : "text-destructive")
      }
    >
      <Icon className="w-3 h-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function BillingPeriodPanel() {
  const { data: txns = [], isLoading } = useAllTransactions();
  const { data: buyPrices = [] } = useBuyPrices(365);
  const buyPriceLookup = useMemo(() => buildBuyPriceLookup(buyPrices), [buyPrices]);
  const periods = useMemo(() => buildPeriods(12), []);
  const [periodKey, setPeriodKey] = useState(periods[0].key);
  const [compare, setCompare] = useState(false);
  const period = periods.find((p) => p.key === periodKey) || periods[0];
  const prevPeriod = periods[periods.findIndex((p) => p.key === period.key) + 1];

  const aggregate = useMemo(() => {
    return (p: Period | undefined) => {
      const byCustomer: Record<string, Agg> = {};
      const totals: Agg = { ...EMPTY };
      if (!p) return { byCustomer, totals };
      txns.forEach((t: any) => {
        if (!t.date || t.date < p.start || t.date > p.end) return;
        const k = t.nombre_cliente1 || t.estacion || "Unassigned";
        if (!byCustomer[k]) byCustomer[k] = { ...EMPTY };
        const litres = t.cantidad || 0;
        const ppl = buyPriceLookup(t.date);
        const cost = ppl != null ? litres * ppl : 0;
        const revenue = t.dinero_total || 0;
        byCustomer[k].litres += litres;
        byCustomer[k].cost += cost;
        byCustomer[k].drops += 1;
        byCustomer[k].revenue += revenue;
        totals.litres += litres;
        totals.cost += cost;
        totals.drops += 1;
        totals.revenue += revenue;
      });
      return { byCustomer, totals };
    };
  }, [txns, buyPriceLookup]);

  const current = useMemo(() => aggregate(period), [aggregate, period]);
  const previous = useMemo(() => aggregate(prevPeriod), [aggregate, prevPeriod]);

  const rows = useMemo(() => {
    const names = new Set([
      ...Object.keys(current.byCustomer),
      ...(compare ? Object.keys(previous.byCustomer) : []),
    ]);
    return Array.from(names)
      .map((customer) => ({
        customer,
        ...(current.byCustomer[customer] || EMPTY),
        prev: previous.byCustomer[customer] || EMPTY,
      }))
      .sort((a, b) => b.litres - a.litres || b.prev.litres - a.prev.litres);
  }, [current, previous, compare]);

  const t = current.totals;
  const pt = previous.totals;

  const summary = [
    { label: "Litres", value: `${Math.round(t.litres).toLocaleString()} L`, prev: `${Math.round(pt.litres).toLocaleString()} L`, pct: pctDelta(t.litres, pt.litres) },
    { label: "Revenue", value: `$${Math.round(t.revenue).toLocaleString()}`, prev: `$${Math.round(pt.revenue).toLocaleString()}`, pct: pctDelta(t.revenue, pt.revenue) },
    { label: "Buy cost", value: `$${Math.round(t.cost).toLocaleString()}`, prev: `$${Math.round(pt.cost).toLocaleString()}`, pct: pctDelta(t.cost, pt.cost), invert: true },
    { label: "Deliveries", value: t.drops.toLocaleString(), prev: pt.drops.toLocaleString(), pct: pctDelta(t.drops, pt.drops) },
    { label: "Customers", value: Object.keys(current.byCustomer).length.toLocaleString(), prev: Object.keys(previous.byCustomer).length.toLocaleString(), pct: pctDelta(Object.keys(current.byCustomer).length, Object.keys(previous.byCustomer).length) },
  ];

  const downloadCsv = () => {
    const header = compare
      ? ["Customer", "Litres", "Prev litres", "Litres delta %", "Deliveries", "Prev deliveries", "Revenue", "Prev revenue", "Buy cost", "Prev buy cost"]
      : ["Customer", "Litres", "Deliveries", "Revenue (inc GST)", "Buy cost (inc GST)"];
    const num = (n: number) => n.toFixed(2);
    const lines = [
      header.join(","),
      ...rows.map((r) => {
        const name = `"${r.customer.replace(/"/g, '""')}"`;
        const d = pctDelta(r.litres, r.prev.litres);
        return compare
          ? [name, num(r.litres), num(r.prev.litres), d == null ? "" : d.toFixed(1), r.drops, r.prev.drops, num(r.revenue), num(r.prev.revenue), num(r.cost), num(r.prev.cost)].join(",")
          : [name, num(r.litres), r.drops, num(r.revenue), num(r.cost)].join(",");
      }),
      compare
        ? ["TOTAL", num(t.litres), num(pt.litres), pctDelta(t.litres, pt.litres)?.toFixed(1) ?? "", t.drops, pt.drops, num(t.revenue), num(pt.revenue), num(t.cost), num(pt.cost)].join(",")
        : ["TOTAL", num(t.litres), t.drops, num(t.revenue), num(t.cost)].join(","),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pacc-invoice-volumes-${period.start}_to_${period.end}${compare ? "-vs-prev" : ""}.csv`;
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            aria-pressed={compare}
            className={
              "h-9 rounded-lg border px-3 text-[13px] font-semibold transition-colors " +
              (compare
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground")
            }
          >
            Compare
          </button>
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

      <div className={"grid gap-3 mt-4 " + (compare ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4")}>
        {summary
          .filter((s) => compare || s.label !== "Revenue")
          .map((s) => (
            <div key={s.label} className="rounded-[10px] border border-border bg-muted/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{s.value}</div>
              {compare && (
                <div className="mt-1 flex items-center gap-1.5">
                  <DeltaChip pct={s.pct} invert={(s as any).invert} />
                  <span className="text-[11px] text-muted-foreground tabular-nums">was {s.prev}</span>
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="mt-2 text-[12px] text-muted-foreground">
        {period.start} → {period.end}
        {compare && prevPeriod && <> · compared with {prevPeriod.label}</>}
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
                {compare && <th className="text-right font-medium py-2">Prev</th>}
                {compare && <th className="text-right font-medium py-2">Δ</th>}
                <th className="text-right font-medium py-2">Drops</th>
                {compare && <th className="text-right font-medium py-2">Revenue</th>}
                <th className="text-right font-medium py-2">Buy cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customer} className="border-t border-border">
                  <td className="py-2 pr-2 text-foreground truncate max-w-[220px]">{r.customer}</td>
                  <td className="py-2 text-right tabular-nums font-semibold text-foreground">{Math.round(r.litres).toLocaleString()}</td>
                  {compare && (
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{Math.round(r.prev.litres).toLocaleString()}</td>
                  )}
                  {compare && (
                    <td className="py-2 text-right">
                      <DeltaChip pct={pctDelta(r.litres, r.prev.litres)} />
                    </td>
                  )}
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{r.drops}</td>
                  {compare && (
                    <td className="py-2 text-right tabular-nums text-foreground">${Math.round(r.revenue).toLocaleString()}</td>
                  )}
                  <td className="py-2 text-right tabular-nums text-foreground">${Math.round(r.cost).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
