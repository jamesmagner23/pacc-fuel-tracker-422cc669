import { useCallback, useMemo, useState } from "react";
import { useAllTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { useOperatingExpenses, dailyRateFor } from "@/hooks/useOperatingExpenses";
import RecurringExpensesPanel from "./RecurringExpensesPanel";
import { subDays, parseISO, format, startOfMonth, endOfMonth, differenceInCalendarDays, eachDayOfInterval } from "date-fns";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine, AreaChart, Area } from "recharts";
import { Wallet, CalendarClock } from "lucide-react";

type Period = "30d" | "90d" | "ytd" | "12m";

const PERIOD_LABELS: Record<Period, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  ytd: "Year to date",
  "12m": "Last 12 months",
};

export default function EBITDATab() {
  const [period, setPeriod] = useState<Period>("30d");
  const [recurringPeriodTotal, setRecurringPeriodTotal] = useState(0);

  const { data: txns = [], isLoading } = useAllTransactions();
  const { data: buyPrices = [] } = useBuyPrices(730);
  const { data: expenses = [] } = useOperatingExpenses();

  const periodStart = useMemo(() => {
    const today = new Date();
    switch (period) {
      case "30d": return subDays(today, 30);
      case "90d": return subDays(today, 90);
      case "ytd": return new Date(today.getFullYear(), 0, 1);
      case "12m": return subDays(today, 365);
    }
  }, [period]);

  const periodDays = useMemo(
    () => Math.max(1, differenceInCalendarDays(new Date(), periodStart) + 1),
    [periodStart]
  );

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
    const totalOpex = recurringPeriodTotal;
    const ebitda = grossProfit - totalOpex;
    return { revenue, cogs, grossProfit, totalOpex, ebitda, litres, gpMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0, ebitdaMargin: revenue > 0 ? (ebitda / revenue) * 100 : 0 };
  }, [periodTxns, sortedBuy, recurringPeriodTotal]);

  // Monthly chart: always show last 12 months for context, pro-rate OpEx by days
  const monthlyChart = useMemo(() => {
    const dailyOpex = recurringPeriodTotal / periodDays;

    const byMonth: Record<string, { revenue: number; cogs: number; litres: number }> = {};
    // Use ALL transactions, not just period — chart is always trailing 12 months
    txns.forEach((t) => {
      const d = parseISO(t.fecha);
      const key = format(startOfMonth(d), "yyyy-MM");
      if (!byMonth[key]) byMonth[key] = { revenue: 0, cogs: 0, litres: 0 };
      const buy = buyPriceFor((t.date || t.fecha.slice(0, 10)) as string);
      byMonth[key].revenue += t.dinero_total || 0;
      byMonth[key].cogs += (t.cantidad || 0) * buy;
      byMonth[key].litres += t.cantidad || 0;
    });

    // Build last 12 month buckets (fills gaps with zeros)
    const buckets: { key: string; label: string }[] = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yy") });
    }

    return buckets.map(({ key, label }) => {
      const v = byMonth[key] || { revenue: 0, cogs: 0, litres: 0 };
      // Days in this month → opex share at the daily rate set by current period
      const monthStart = parseISO(key + "-01");
      const daysInMonth = differenceInCalendarDays(endOfMonth(monthStart), monthStart) + 1;
      const opexShare = dailyOpex * daysInMonth;
      const gp = v.revenue - v.cogs;
      return {
        month: label,
        revenue: Math.round(v.revenue),
        cogs: Math.round(v.cogs),
        opex: Math.round(opexShare),
        gp: Math.round(gp),
        ebitda: Math.round(gp - opexShare),
      };
    });
  }, [txns, sortedBuy, recurringPeriodTotal, periodStart, periodDays]);

  // Sum of daily repayments contribution from active 'Repayments' expenses
  const dailyRepayments = useMemo(
    () =>
      expenses
        .filter((e) => e.is_active && e.category === "Repayments")
        .reduce((s, e) => s + dailyRateFor(e), 0),
    [expenses]
  );

  const repaymentsSeries = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({ start: periodStart, end: today });
    if (days.length === 0) return [];
    return days.map((d) => ({
      date: format(d, "MMM d"),
      repayment: Math.round(dailyRepayments),
      rolling: Math.round(dailyRepayments),
    }));
  }, [dailyRepayments, periodStart]);

  // Scheduled (smoothed daily rate) vs Actual (lumpy on next_due_date) cumulative projection
  const projectionSeries = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({ start: periodStart, end: today });
    if (days.length === 0) return [];

    const activeExp = expenses.filter((e) => e.is_active);
    const dailyTotal = activeExp.reduce((s, e) => s + dailyRateFor(e), 0);

    // Map of yyyy-MM-dd → actual hits within the period (one-off + recurring whose next_due_date is inside window)
    const hitsByDay: Record<string, number> = {};
    activeExp.forEach((e) => {
      if (!e.next_due_date) return;
      const due = parseISO(e.next_due_date);
      if (due < periodStart || due > today) return;
      const k = format(due, "yyyy-MM-dd");
      hitsByDay[k] = (hitsByDay[k] || 0) + (Number(e.amount) || 0);
    });

    let cumScheduled = 0;
    let cumActual = 0;
    return days.map((d) => {
      cumScheduled += dailyTotal;
      cumActual += hitsByDay[format(d, "yyyy-MM-dd")] || 0;
      return {
        date: format(d, "MMM d"),
        scheduled: Math.round(cumScheduled),
        actual: Math.round(cumActual),
      };
    });
  }, [expenses, periodStart]);

  const projectionTotals = useMemo(() => {
    const last = projectionSeries[projectionSeries.length - 1];
    const scheduled = last?.scheduled ?? 0;
    const actual = last?.actual ?? 0;
    return { scheduled, actual, variance: actual - scheduled };
  }, [projectionSeries]);

  const handleRecurringTotal = useCallback((total: number) => setRecurringPeriodTotal(total), []);

  const accent = "var(--accent)";
  const muted = "var(--text-secondary)";

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
                background: period === p.v ? "var(--accent)" : "transparent",
                color: period === p.v ? "#ffffff" : "var(--text-secondary)",
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Monthly P&amp;L — Last 12 Months</h3>
            <span className="text-[10px] text-muted-foreground">EBITDA line uses OpEx pro-rated daily from selected period</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={monthlyChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--surface-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }}
                  labelStyle={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "var(--text-primary)" }}
                  formatter={(v: number, name: string) => [`$${Number(v).toLocaleString()}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
                <ReferenceLine y={0} stroke="var(--surface-border)" />
                {/* Revenue alongside stacked costs for easy comparison */}
                <Bar dataKey="revenue" name="Revenue" fill={accent} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cogs" name="COGS (Fuel)" stackId="cost" fill="#3F6B36" radius={[0, 0, 0, 0]} maxBarSize={28} />
                <Bar dataKey="opex" name="OpEx" stackId="cost" fill="#1B3520" stroke="#3F6B36" strokeWidth={1} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#C8F26A" strokeWidth={2.5} dot={{ r: 3, fill: "#C8F26A" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Recurring expenses (drives EBITDA OpEx) */}
      <RecurringExpensesPanel periodDays={periodDays} onPeriodTotalChange={handleRecurringTotal} />

      <div className="text-[10px] text-muted-foreground">
        COGS calculated as litres × supplier buy price on each transaction date. Adjust buy prices in Finance → Buy Prices.
      </div>

      {/* Repayments time-series */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Loan Repayments — {PERIOD_LABELS[period]}</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>Period total: <span className="text-foreground font-medium tabular-nums">${Math.round(dailyRepayments * periodDays).toLocaleString()}</span></span>
            <span>Daily: <span className="text-foreground font-medium tabular-nums">${dailyRepayments.toFixed(2)}</span></span>
          </div>
        </div>
        {dailyRepayments > 0 ? (
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={repaymentsSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="repayFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--surface-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: muted }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: muted }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }}
                  labelStyle={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "var(--text-primary)" }}
                  formatter={(v: number, name: string) => [`$${Number(v).toLocaleString()}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
                <Area type="monotone" dataKey="repayment" name="Daily repayment" stroke={accent} strokeWidth={2} fill="url(#repayFill)" />
                <Line type="monotone" dataKey="rolling" name="7-day rolling avg" stroke="#C8F26A" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-12">
            Add a Repayments-category expense above to see the time-series breakdown.
          </div>
        )}
      </div>

      {/* Scheduled vs Actual projection */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Scheduled vs Actual OpEx — {PERIOD_LABELS[period]}</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span>Scheduled: <span className="text-foreground font-medium tabular-nums">${projectionTotals.scheduled.toLocaleString()}</span></span>
            <span>Actual due: <span className="text-foreground font-medium tabular-nums">${projectionTotals.actual.toLocaleString()}</span></span>
            <span>
              Variance:{" "}
              <span
                className={`font-medium tabular-nums ${
                  projectionTotals.variance > 0
                    ? "text-destructive"
                    : projectionTotals.variance < 0
                    ? "text-positive"
                    : "text-foreground"
                }`}
              >
                {projectionTotals.variance >= 0 ? "+" : ""}${projectionTotals.variance.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
        {projectionSeries.length > 0 ? (
          <>
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={projectionSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="schedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accent} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--surface-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: muted }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: muted }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }}
                    labelStyle={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}
                    itemStyle={{ color: "var(--text-primary)" }}
                    formatter={(v: number, name: string) => [`$${Number(v).toLocaleString()}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
                  <Area
                    type="monotone"
                    dataKey="scheduled"
                    name="Scheduled (smoothed)"
                    stroke={accent}
                    strokeWidth={2}
                    fill="url(#schedFill)"
                  />
                  <Line
                    type="stepAfter"
                    dataKey="actual"
                    name="Actual due (cash hits)"
                    stroke="#C8F26A"
                    strokeWidth={2}
                    dot={{ r: 2, fill: "#C8F26A" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Scheduled is the smoothed daily accrual used by EBITDA. Actual steps up on each expense's next-due date inside the period — useful for spotting cash-flow lumps vs steady-state cost.
            </p>
          </>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-12">
            No data for this period yet.
          </div>
        )}
      </div>
    </div>
  );
}