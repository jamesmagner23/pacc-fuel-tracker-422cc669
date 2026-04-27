import { useMemo, useState } from "react";
import { useAllTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { subDays, parseISO, format, startOfMonth, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const STORAGE_KEY = "admin_ebitda_opex_v1";
const DEFAULT_OPEX = {
  wages: 0,
  fleet: 0,
  rent: 0,
  insurance: 0,
  fuel: 0,
  other: 0,
};

export default function EBITDATab() {
  const [period, setPeriod] = useState<"30d" | "90d" | "ytd" | "12m">("30d");
  const [opex, setOpex] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_OPEX, ...JSON.parse(saved) } : DEFAULT_OPEX;
    } catch {
      return DEFAULT_OPEX;
    }
  });

  const { data: txns = [], isLoading } = useAllTransactions();
  const { data: buyPrices = [] } = useBuyPrices(730);

  const periodStart = useMemo(() => {
    const today = new Date();
    switch (period) {
      case "30d": return subDays(today, 30);
      case "90d": return subDays(today, 90);
      case "ytd": return new Date(today.getFullYear(), 0, 1);
      case "12m": return subDays(today, 365);
    }
  }, [period]);

  // Sorted buy prices ascending for lookup
  const sortedBuy = useMemo(
    () => [...buyPrices].sort((a, b) => a.price_date.localeCompare(b.price_date)),
    [buyPrices]
  );

  const buyPriceFor = (dateStr: string): number => {
    if (!sortedBuy.length) return 0;
    let last = sortedBuy[0].price_per_litre;
    for (const p of sortedBuy) {
      if (p.price_date <= dateStr) last = p.price_per_litre;
      else break;
    }
    return last;
  };

  const periodTxns = useMemo(
    () => txns.filter((t) => new Date(t.fecha) >= periodStart),
    [txns, periodStart]
  );

  const totals = useMemo(() => {
    let revenue = 0, cogs = 0, litres = 0;
    periodTxns.forEach((t) => {
      const r = t.dinero_total || 0;
      const l = t.cantidad || 0;
      const buy = buyPriceFor((t.date || t.fecha.slice(0, 10)) as string);
      revenue += r;
      litres += l;
      cogs += l * buy;
    });
    const grossProfit = revenue - cogs;
    const totalOpex = Object.values(opex).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    const ebitda = grossProfit - totalOpex;
    return { revenue, cogs, grossProfit, totalOpex, ebitda, litres, gpMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0, ebitdaMargin: revenue > 0 ? (ebitda / revenue) * 100 : 0 };
  }, [periodTxns, sortedBuy, opex]);

  // Monthly chart
  const monthlyChart = useMemo(() => {
    const byMonth: Record<string, { revenue: number; cogs: number; litres: number }> = {};
    periodTxns.forEach((t) => {
      const d = parseISO(t.fecha);
      const key = format(startOfMonth(d), "yyyy-MM");
      if (!byMonth[key]) byMonth[key] = { revenue: 0, cogs: 0, litres: 0 };
      const buy = buyPriceFor((t.date || t.fecha.slice(0, 10)) as string);
      byMonth[key].revenue += t.dinero_total || 0;
      byMonth[key].cogs += (t.cantidad || 0) * buy;
      byMonth[key].litres += t.cantidad || 0;
    });
    const totalOpex = Object.values(opex).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        // Pro-rate opex if period > 1 month: distribute as monthly rate
        const months = Object.keys(byMonth).length || 1;
        const opexShare = totalOpex / months;
        const gp = v.revenue - v.cogs;
        return {
          month: format(parseISO(k + "-01"), "MMM yy"),
          revenue: Math.round(v.revenue),
          cogs: Math.round(v.cogs),
          opex: Math.round(opexShare),
          ebitda: Math.round(gp - opexShare),
        };
      });
  }, [periodTxns, sortedBuy, opex]);

  const handleOpex = (key: string, val: string) => {
    const next = { ...opex, [key]: Number(val) || 0 };
    setOpex(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const accent = "hsl(var(--primary))";
  const muted = "hsl(var(--muted-foreground))";

  if (isLoading) return <div className="text-muted-foreground py-12 text-center">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold">EBITDA & Profitability</h2>
        <div className="flex gap-1 bg-surface border border-surface-border rounded-lg p-1">
          {[
            { v: "30d", l: "30d" },
            { v: "90d", l: "90d" },
            { v: "ytd", l: "YTD" },
            { v: "12m", l: "12m" },
          ].map((p) => (
            <button
              key={p.v}
              onClick={() => setPeriod(p.v as any)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: period === p.v ? "hsl(var(--primary))" : "transparent",
                color: period === p.v ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              }}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Revenue", value: totals.revenue, color: "text-foreground" },
          { label: "COGS (Fuel)", value: totals.cogs, color: "text-foreground" },
          { label: "Gross Profit", value: totals.grossProfit, sub: `${totals.gpMargin.toFixed(1)}%`, color: totals.grossProfit >= 0 ? "text-positive" : "text-destructive" },
          { label: "OpEx", value: totals.totalOpex, color: "text-foreground" },
          { label: "EBITDA", value: totals.ebitda, sub: `${totals.ebitdaMargin.toFixed(1)}%`, color: totals.ebitda >= 0 ? "text-positive" : "text-destructive" },
        ].map((k) => (
          <div key={k.label} className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</div>
            <div className={`text-xl font-bold mt-1 tabular-nums ${k.color}`}>
              ${Math.round(k.value).toLocaleString()}
            </div>
            {k.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub} margin</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-surface border border-surface-border rounded-[10px] p-5">
          <h3 className="text-sm font-semibold mb-3">Monthly P&L</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={monthlyChart}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill={accent} radius={[3, 3, 0, 0]} />
                <Bar dataKey="cogs" name="COGS" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ebitda" name="EBITDA" fill="hsl(var(--positive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* OpEx editor */}
        <div className="bg-surface border border-surface-border rounded-[10px] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Operating Expenses</h3>
          </div>
          <p className="text-[11px] text-muted-foreground">Total for selected period. Saved locally.</p>
          {[
            { key: "wages", label: "Wages & Salaries" },
            { key: "fleet", label: "Fleet & Maintenance" },
            { key: "fuel", label: "Vehicle Fuel" },
            { key: "rent", label: "Rent & Utilities" },
            { key: "insurance", label: "Insurance" },
            { key: "other", label: "Other" },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-2">
              <label className="text-xs text-muted-foreground flex-1">{row.label}</label>
              <div className="relative w-32">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  value={opex[row.key as keyof typeof opex] || ""}
                  onChange={(e) => handleOpex(row.key, e.target.value)}
                  className="w-full bg-[hsl(var(--muted))] border border-surface-border rounded-md pl-5 pr-2 py-1.5 text-xs text-foreground tabular-nums text-right outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
          <div className="border-t border-border pt-3 flex justify-between text-sm font-semibold">
            <span>Total OpEx</span>
            <span className="tabular-nums">${totals.totalOpex.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground">
        COGS calculated as litres × supplier buy price on each transaction date. Adjust buy prices in Finance → Buy Prices.
      </div>
    </div>
  );
}