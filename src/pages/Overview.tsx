import { useMemo, useState } from "react";
import { TruckMap } from "@/components/TruckMap";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  Legend, CartesianGrid,
} from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { format, parseISO } from "date-fns";
import { Droplets, TrendingUp, TrendingDown, Clock, Truck, MapPin, Fuel, Gauge } from "lucide-react";

/** Read a CSS variable at render time so charts pick up theme overrides */
function cssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function useThemeColors() {
  // Re-read on every render so demo overrides are picked up
  const surface = cssVar("--surface", "#4A3525");
  const border = cssVar("--surface-border", "#6B5240");
  const textPrimary = cssVar("--text-primary", "#F5E6D0");
  const textSecondary = cssVar("--text-secondary", "#C4A882");
  const textMuted = cssVar("--text-muted", "#8B7355");
  const accent = cssVar("--accent", "#E8461E");
  const surfaceHover = cssVar("--surface-hover", "#5A4535");
  return { surface, border, textPrimary, textSecondary, textMuted, accent, surfaceHover };
}

const SERIES_COLORS = ["#E8461E", "#FF8A5C", "#F5E6D0", "#C4A882", "#D88B5C"];

function TopCustomersTrendCard({
  series,
  totals,
}: {
  series: { date: string; [k: string]: string | number }[];
  totals: { name: string; litres: number }[];
}) {
  const tc = useThemeColors();
  const grandTotal = totals.reduce((s, x) => s + x.litres, 0);
  return (
    <div style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, padding: "20px 24px" }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium" style={{ color: tc.textPrimary }}>Top Customers — Trend</div>
      </div>
      <div className="text-[11px] mb-4" style={{ color: tc.textSecondary }}>Daily litres by top 5 customers</div>
      <div style={{ height: 220 }}>
        {series.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: tc.textSecondary }}>No data in range.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={tc.border} strokeDasharray="2 4" vertical={false} opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: tc.textSecondary }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: tc.textSecondary }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Tooltip
                contentStyle={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: tc.textPrimary }}
                itemStyle={{ color: tc.textPrimary }}
                formatter={(v: number) => [`${v.toLocaleString()}L`, ""]}
              />
              {totals.slice(0, 5).map((c, i) => (
                <Line key={c.name} type="monotone" dataKey={c.name} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-col gap-1.5 mt-3">
        {totals.slice(0, 5).map((c, i) => {
          const pct = grandTotal > 0 ? ((c.litres / grandTotal) * 100).toFixed(0) : "0";
          return (
            <div key={c.name} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              <span className="text-xs flex-1 truncate" style={{ color: tc.textSecondary }}>{c.name}</span>
              <span className="text-[11px] tabular-nums shrink-0" style={{ color: tc.textMuted }}>{pct}%</span>
              <span className="text-xs tabular-nums shrink-0 text-right w-[60px] font-medium" style={{ color: tc.textPrimary }}>
                {(c.litres / 1000).toFixed(1)}k L
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FuelBuyPriceCard({ priceData }: { priceData: { date: string; price: number }[] }) {
  const tc = useThemeColors();
  const prices = priceData.map((p) => p.price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const avg = prices.length ? prices.reduce((s, v) => s + v, 0) / prices.length : 0;
  const latest = prices.length ? prices[prices.length - 1] : 0;
  const first = prices.length ? prices[0] : 0;
  const change = first > 0 ? ((latest - first) / first) * 100 : 0;

  return (
    <div style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, padding: "20px 24px" }}>
      <div className="flex items-start justify-between mb-1 gap-3">
        <div>
          <div className="text-sm font-medium" style={{ color: tc.textPrimary }}>Fuel Buy Price</div>
          <div className="text-[11px]" style={{ color: tc.textSecondary }}>Supply cost trend ($/L)</div>
        </div>
        {priceData.length > 0 && (
          <div className="text-right">
            <div className="text-2xl font-light tabular-nums leading-none" style={{ color: tc.textPrimary }}>${latest.toFixed(3)}</div>
            <div className="flex items-center justify-end gap-1 mt-1">
              {change >= 0 ? <TrendingUp className="w-3 h-3 text-red-500" /> : <TrendingDown className="w-3 h-3 text-emerald-500" />}
              <span className={`text-[11px] font-medium ${change >= 0 ? "text-red-500" : "text-emerald-500"}`}>
                {change >= 0 ? "+" : ""}{change.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
        {[
          { label: "Min", value: min },
          { label: "Avg", value: avg },
          { label: "Max", value: max },
        ].map((s) => (
          <div key={s.label} className="rounded-md px-2 py-1.5" style={{ background: tc.surfaceHover }}>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: tc.textMuted }}>{s.label}</div>
            <div className="text-xs font-medium tabular-nums" style={{ color: tc.textPrimary }}>${s.value.toFixed(3)}</div>
          </div>
        ))}
      </div>

      <div style={{ height: 200 }}>
        {priceData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tc.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={tc.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={tc.border} strokeDasharray="2 4" vertical={false} opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: tc.textSecondary }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: tc.textSecondary }} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: tc.textPrimary }}
                itemStyle={{ color: tc.textPrimary }}
                formatter={(v: number) => [`$${v.toFixed(3)}/L`, "Price"]}
              />
              <Area type="monotone" dataKey="price" stroke={tc.accent} strokeWidth={2} fill="url(#priceGrad)" dot={{ r: 2, fill: tc.accent, strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: tc.textSecondary }}>
            No price data yet. Add prices in Finance → Buy Price.
          </div>
        )}
      </div>
    </div>
  );
}

function TruckBreakEvenCard({
  trucks,
}: {
  trucks: { placa: string; litres: number; revenue: number; deliveries: number }[];
}) {
  const tc = useThemeColors();
  // Simple break-even heuristic: assume daily fixed cost per truck of $450 (wages+rego+insurance)
  // and gross margin per litre ≈ revenue/litre - $1.50 buy estimate. This is an indicative visual.
  const FIXED_DAILY_COST = 450;
  const ASSUMED_BUY = 1.5;

  return (
    <div style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, padding: "20px 24px" }}>
      <div className="flex items-center gap-2 mb-1">
        <Gauge className="w-4 h-4" style={{ color: tc.accent }} />
        <div className="text-sm font-medium" style={{ color: tc.textPrimary }}>Truck Break-Even</div>
      </div>
      <div className="text-[11px] mb-4" style={{ color: tc.textSecondary }}>Indicative progress per truck for selected period</div>
      {trucks.length === 0 ? (
        <div className="text-center text-xs py-6" style={{ color: tc.textSecondary }}>No truck data in range.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {trucks.slice(0, 2).map((t) => {
            const sellPerL = t.litres > 0 ? t.revenue / t.litres : 0;
            const marginPerL = Math.max(sellPerL - ASSUMED_BUY, 0.01);
            const breakEvenLitres = FIXED_DAILY_COST / marginPerL;
            const pct = Math.min((t.litres / breakEvenLitres) * 100, 200);
            const reached = pct >= 100;
            return (
              <div key={t.placa}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5" style={{ color: tc.textSecondary }} />
                    <span className="text-xs font-medium" style={{ color: tc.textPrimary }}>{t.placa || "Unknown"}</span>
                  </div>
                  <div className="text-[11px] tabular-nums" style={{ color: tc.textSecondary }}>
                    {t.litres.toLocaleString()}L / {Math.round(breakEvenLitres).toLocaleString()}L
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden relative" style={{ background: tc.surfaceHover }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%`, background: reached ? "#10B981" : tc.accent }}
                  />
                  {pct > 100 && (
                    <div
                      className="absolute top-0 h-full rounded-full"
                      style={{ left: "100%", width: `${Math.min(pct - 100, 100)}%`, background: "rgba(16,185,129,0.4)", transform: "translateX(-100%)" }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px]" style={{ color: tc.textMuted }}>{t.deliveries} deliveries · ${sellPerL.toFixed(2)}/L</span>
                  <span className={`text-[10px] font-medium ${reached ? "text-emerald-500" : ""}`} style={!reached ? { color: tc.textSecondary } : undefined}>
                    {pct.toFixed(0)}% {reached ? "✓" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="text-[9px] mt-3" style={{ color: tc.textMuted }}>
        Indicative — assumes $450/day fixed cost & $1.50/L buy. Adjust in Admin → EBITDA.
      </div>
    </div>
  );
}

export default function Overview() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: previous = [] } = usePreviousTransactions(range);
  const { data: buyPrices = [] } = useBuyPrices(90);
  const tc = useThemeColors();

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const totalRevenue = filtered.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const numDeliveries = filtered.length;
  const avgSize = numDeliveries > 0 ? totalLitres / numDeliveries : 0;

  const prevLitres = previous.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevRevenue = previous.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const prevDeliveries = previous.length;
  const prevAvgSize = prevDeliveries > 0 ? prevLitres / prevDeliveries : 0;

  const pct = (curr: number, prev: number) => (prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);

  const litresPct = pct(totalLitres, prevLitres);
  const revPct = pct(totalRevenue, prevRevenue);
  const delPct = pct(numDeliveries, prevDeliveries);
  const avgPct = pct(avgSize, prevAvgSize);

  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + (t.cantidad || 0); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, litres]) => ({ date: format(parseISO(date), "dd MMM"), litres }));
  }, [filtered]);

  const hourlyData = useMemo(() => {
    if (range !== "today") return [];
    const hours: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hours[h] = 0;
    filtered.forEach((t) => { const hour = new Date(t.fecha).getHours(); hours[hour] += t.cantidad || 0; });
    return Object.entries(hours).map(([h, litres]) => ({ hour: `${String(h).padStart(2, "0")}:00`, litres })).filter((_, i) => i >= 5 && i <= 22);
  }, [filtered, range]);

  const recentDeliveries = useMemo(() => {
    if (range !== "today") return [];
    return [...filtered].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 12);
  }, [filtered, range]);

  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; litres: number }> = {};
    filtered.forEach((t) => { const name = t.nombre_cliente1 || "Unknown"; if (!map[name]) map[name] = { name, litres: 0 }; map[name].litres += t.cantidad || 0; });
    return Object.values(map).sort((a, b) => b.litres - a.litres).slice(0, 6);
  }, [filtered]);

  const topCustomersSeries = useMemo(() => {
    const top5 = topCustomers.slice(0, 5).map((c) => c.name);
    if (top5.length === 0) return [];
    const byDate: Record<string, Record<string, number>> = {};
    filtered.forEach((t) => {
      if (!t.date) return;
      const name = t.nombre_cliente1 || "Unknown";
      if (!top5.includes(name)) return;
      if (!byDate[t.date]) byDate[t.date] = {};
      byDate[t.date][name] = (byDate[t.date][name] || 0) + (t.cantidad || 0);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => {
        const row: Record<string, string | number> = { date: format(parseISO(date), "dd MMM") };
        top5.forEach((n) => { row[n] = vals[n] || 0; });
        return row;
      });
  }, [filtered, topCustomers]);

  const truckStats = useMemo(() => {
    const map: Record<string, { placa: string; litres: number; revenue: number; deliveries: number }> = {};
    filtered.forEach((t) => {
      const placa = t.placa || "Unknown";
      if (!map[placa]) map[placa] = { placa, litres: 0, revenue: 0, deliveries: 0 };
      map[placa].litres += t.cantidad || 0;
      map[placa].revenue += t.dinero_total || 0;
      map[placa].deliveries += 1;
    });
    return Object.values(map).sort((a, b) => b.litres - a.litres);
  }, [filtered]);

  const priceData = useMemo(() => {
    return [...buyPrices].sort((a, b) => a.price_date.localeCompare(b.price_date)).map((p) => ({ date: format(parseISO(p.price_date), "dd MMM"), price: p.price_per_litre }));
  }, [buyPrices]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Loading...</div>;
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-3">
        <Droplets className="w-6 h-6" />
        <p className="text-sm">No transactions. Click <strong className="text-foreground">Sync Now</strong> to pull data.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 max-w-[1200px] w-full">
      {/* HERO SECTION */}
      <div
        className="px-4 pt-5 pb-0 sm:px-8 sm:pt-7"
        style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, overflow: "hidden" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: tc.textSecondary }}>Total Litres Delivered</div>
            <div className="text-3xl sm:text-[56px] font-light tracking-tighter leading-none tabular-nums" style={{ color: tc.textPrimary }}>
              {totalLitres >= 1000 ? `${(totalLitres / 1000).toFixed(2)}k L` : `${totalLitres.toFixed(1)} L`}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5">
              {litresPct >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
              <span className={`text-xs font-medium ${litresPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {litresPct >= 0 ? "+" : ""}{litresPct.toFixed(1)}%
              </span>
              <span className="text-xs" style={{ color: tc.textSecondary }}>vs previous period</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-8 sm:flex pt-1">
            {[
              { label: "Revenue", value: "$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), p: revPct },
              { label: "Deliveries", value: numDeliveries.toString(), p: delPct },
              { label: "Avg Size", value: Math.round(avgSize) + "L", p: avgPct },
            ].map((k) => (
              <div key={k.label} className="text-left sm:text-right">
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: tc.textSecondary }}>{k.label}</div>
                <div className="text-lg sm:text-xl font-medium tracking-tight tabular-nums" style={{ color: tc.textPrimary }}>{k.value}</div>
                <div className={`text-[11px] mt-0.5 ${k.p >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {k.p >= 0 ? "+" : ""}{k.p.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="-mx-4 sm:-mx-8" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="litresGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tc.accent} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={tc.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: tc.textSecondary }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: tc.textPrimary }}
                itemStyle={{ color: tc.textPrimary }}
                formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="litres" stroke={tc.accent} strokeWidth={1.5} fill="url(#litresGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <TruckMap height={260} showStops={true} />

      <div className="mt-[1px]">
        <TruckBreakEvenCard trucks={truckStats} />
      </div>

      {range === "today" && (
        <div style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, padding: "20px 24px", marginTop: 1 }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4" style={{ color: tc.accent }} />
            <div className="text-sm font-medium" style={{ color: tc.textPrimary }}>Today's Deliveries</div>
          </div>
          <div className="text-[11px] mb-4" style={{ color: tc.textSecondary }}>Live feed — most recent first</div>
          {recentDeliveries.length === 0 ? (
            <div className="text-center text-xs py-8" style={{ color: tc.textSecondary }}>No deliveries recorded today yet.</div>
          ) : (
            <div className="flex flex-col" style={{ borderColor: tc.border }}>
              {recentDeliveries.map((t) => (
                <div key={t.id} className="flex items-start gap-2 sm:gap-3 py-2.5 -mx-3 px-3 rounded-lg transition-colors"
                  style={{ borderBottom: `1px solid ${tc.border}` }}
                  onMouseEnter={(e) => e.currentTarget.style.background = tc.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <div className="w-[40px] sm:w-[52px] text-[11px] tabular-nums shrink-0 pt-0.5" style={{ color: tc.textSecondary }}>
                    {format(new Date(t.fecha), "HH:mm")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: tc.textPrimary }}>{t.nombre_cliente1 || "Walk-in"}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] mt-0.5" style={{ color: tc.textSecondary }}>
                      {t.placa && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{t.placa}</span>}
                      {t.estacion && <span className="flex items-center gap-1 hidden sm:flex"><MapPin className="w-3 h-3" />{t.estacion}</span>}
                      {t.producto && <span className="flex items-center gap-1 hidden sm:flex"><Fuel className="w-3 h-3" />{t.producto}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums" style={{ color: tc.textPrimary }}>{(t.cantidad || 0).toLocaleString()}L</div>
                    {t.dinero_total != null && (
                      <div className="text-[11px] tabular-nums hidden sm:block" style={{ color: tc.textSecondary }}>
                        ${t.dinero_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1px] mt-[1px]">
        <TopCustomersTrendCard series={topCustomersSeries} totals={topCustomers} />
        <FuelBuyPriceCard priceData={priceData} />
      </div>
    </div>
  );
}
