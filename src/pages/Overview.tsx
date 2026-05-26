import { useMemo, useState } from "react";
import { TruckMap } from "@/components/TruckMap";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { DateRangeToggle } from "@/components/DateRangeToggle";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { useRevenueCalc } from "@/hooks/useRevenueCalc";
import { format, parseISO } from "date-fns";
import { Droplets, Clock, Truck, MapPin, Fuel } from "lucide-react";
import { useChartPalette } from "@/lib/chartPalette";
import { formatTime } from "@/lib/format";

/** Read a CSS variable at render time so charts pick up theme overrides */
function cssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function useThemeColors() {
  // Re-read on every render so demo overrides are picked up
  const surface = cssVar("--surface", "#142A16");
  const border = cssVar("--surface-border", "#2A4A2E");
  const textPrimary = cssVar("--text-primary", "#ECE4D2");
  const textSecondary = cssVar("--text-secondary", "#C7BFAC");
  const textMuted = cssVar("--text-muted", "#8B8773");
  const accent = cssVar("--accent", "#C8F26A");
  const surfaceHover = cssVar("--surface-hover", "#1F3A24");
  return { surface, border, textPrimary, textSecondary, textMuted, accent, surfaceHover };
}

function DonutCard({ topCustomers }: { topCustomers: { name: string; litres: number }[] }) {
  const [showPct, setShowPct] = useState(false);
  const total = topCustomers.reduce((s, x) => s + x.litres, 0);
  const tc = useThemeColors();
  const palette = useChartPalette();
  const PIE_COLORS = palette.categorical;

  return (
    <div style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, padding: "20px 24px" }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium" style={{ color: tc.textPrimary }}>Top Customers</div>
        <button
          type="button"
          aria-label={showPct ? "Show customer share in litres" : "Show customer share in percent"}
          onClick={() => setShowPct((p) => !p)}
          className="text-[10px] px-2 py-0.5 rounded-full border transition-colors"
          style={{ borderColor: tc.textSecondary, color: tc.textSecondary, background: "transparent", cursor: "pointer" }}
        >
          {showPct ? "Show Litres" : "Show %"}
        </button>
      </div>
      <div className="text-[11px] mb-4" style={{ color: tc.textSecondary }}>Volume share by customer</div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-[180px] shrink-0" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={topCustomers} dataKey="litres" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} strokeWidth={0}>
                {topCustomers.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: tc.textPrimary }}
                itemStyle={{ color: tc.textPrimary }}
                formatter={(v: number) => { const pctVal = total > 0 ? ((v / total) * 100).toFixed(1) : "0"; return [`${(v / 1000).toFixed(1)}k L (${pctVal}%)`, ""]; }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2.5 min-w-0 w-full sm:flex-1">
          {topCustomers.map((c, i) => {
            const pctVal = total > 0 ? ((c.litres / total) * 100).toFixed(0) : "0";
            return (
              <div key={c.name} className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-xs flex-1 truncate" style={{ color: tc.textSecondary }}>{c.name}</span>
                <span className="text-xs tabular-nums shrink-0 text-right w-[70px] font-medium" style={{ color: tc.textSecondary }}>
                  {showPct ? `${pctVal}%` : `${(c.litres / 1000).toFixed(1)}k L`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { range } = useDateRange();
  const {
    filtered,
    previous,
    isLoading,
    totalRevenue,
    prevRevenue,
  } = useRevenueCalc(range);
  const { data: buyPrices = [] } = useBuyPrices(90);
  const tc = useThemeColors();
  const palette = useChartPalette();

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const numDeliveries = filtered.length;
  const avgSize = numDeliveries > 0 ? totalLitres / numDeliveries : 0;

  const prevLitres = previous.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevDeliveries = previous.length;
  const prevAvgSize = prevDeliveries > 0 ? prevLitres / prevDeliveries : 0;

  // Return null when there's no prior baseline to compare to. Otherwise we'd
  // show "+100%" on every metric the first time a customer loads data, which
  // trains users to ignore the delta chip entirely.
  const pct = (curr: number, prev: number): number | null =>
    prev === 0 ? null : ((curr - prev) / prev) * 100;

  const litresPct = pct(totalLitres, prevLitres);
  const revPct = pct(totalRevenue, prevRevenue);
  const delPct = pct(numDeliveries, prevDeliveries);
  const avgPct = pct(avgSize, prevAvgSize);

  const Delta = ({ p }: { p: number | null }) => {
    if (p === null) {
      return (
        <span className="text-[11px]" style={{ color: tc.textSecondary }}>—</span>
      );
    }
    const up = p >= 0;
    return (
      <span className={`text-[11px] font-medium ${up ? "text-emerald-500" : "text-red-500"}`}>
        {up ? "+" : ""}{p.toFixed(1)}%
      </span>
    );
  };

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
      {/* Page heading — period selector inline on desktop, stacked on mobile */}
      <div className="px-1 pt-1 pb-0 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time fuel delivery performance and insights</p>
        </div>
        <div className="self-start md:self-end"><DateRangeToggle /></div>
      </div>

      {/* HERO SECTION */}
      {/* 4 equal KPI tiles — easier to scan than the old hero+supporting hybrid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        {[
          { label: "Total Litres", value: totalLitres >= 1000 ? `${(totalLitres / 1000).toFixed(2)}k L` : `${totalLitres.toFixed(1)} L`, p: litresPct },
          { label: "Revenue", value: "$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), p: revPct },
          { label: "Deliveries", value: numDeliveries.toLocaleString(), p: delPct },
          { label: "Avg Size", value: Math.round(avgSize).toLocaleString() + "L", p: avgPct },
        ].map((k) => (
          <div
            key={k.label}
            style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, padding: "16px 18px" }}
          >
            <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: tc.textSecondary }}>{k.label}</div>
            <div className="text-2xl sm:text-[28px] font-semibold tracking-tight tabular-nums" style={{ color: tc.textPrimary }}>{k.value}</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Delta p={k.p} />
              <span className="text-[11px]" style={{ color: tc.textSecondary }}>vs prev</span>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart — full-width card. With < 2 points show an inline
          empty state instead of a broken single-dot line. */}
      <div
        className="px-6 py-5 mt-3"
        style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12 }}
      >
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: tc.textSecondary, letterSpacing: "0.08em" }}>Litres Delivered — Trend</div>
          <div className="text-[11px]" style={{ color: tc.textSecondary }}>
            {range === "today" ? "Today" : range === "week" ? "This Week" : "This Month"}
          </div>
        </div>
        <div style={{ height: 200 }}>
          {dailyData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: tc.textSecondary }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: tc.textPrimary }}
                  itemStyle={{ color: tc.textPrimary }}
                  formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]}
                  cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 1 }}
                />
                <Line type="monotone" dataKey="litres" stroke={tc.textPrimary} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-center px-6" style={{ color: tc.textSecondary, fontSize: 13 }}>
              Trend appears with 2+ data points. Switch to This Week or This Month to see history.
            </div>
          )}
        </div>
      </div>

      <TruckMap height={260} showStops={true} />

      {range === "today" && (
        <div style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, padding: "20px 24px", marginTop: 1 }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4" style={{ color: tc.textPrimary }} />
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
                  <div className="w-[52px] sm:w-[64px] text-[11px] tabular-nums shrink-0 pt-0.5" style={{ color: tc.textSecondary }}>
                    {formatTime(t.fecha)}
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
        <DonutCard topCustomers={topCustomers} />

        <div style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12, padding: "20px 24px" }}>
          <div className="text-sm font-medium mb-1" style={{ color: tc.textPrimary }}>Fuel Buy Price</div>
          <div className="text-[11px] mb-4" style={{ color: tc.textSecondary }}>Supply price trend ($/L)</div>
          <div style={{ height: 260 }}>
            {priceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: tc.textSecondary }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: tc.textSecondary }} axisLine={false} tickLine={false} width={50} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: tc.textPrimary }}
                    itemStyle={{ color: tc.textPrimary }}
                    formatter={(v: number) => [`$${v.toFixed(2)}/L`, "Price"]}
                  />
                  <Line type="monotone" dataKey="price" stroke={palette.primary} strokeWidth={2} dot={{ r: 3, fill: palette.primary }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: tc.textSecondary }}>
                No price data yet. Add prices in Finance → Buy Price.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
