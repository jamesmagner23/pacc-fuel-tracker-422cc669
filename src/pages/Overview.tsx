import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { format, parseISO } from "date-fns";
import { Droplets, TrendingUp, TrendingDown } from "lucide-react";

const PIE_COLORS = ["#7C3AED", "#A78BFA", "#C4B5FD", "#DDD6FE", "#EDE9FE", "#6D28D9"];

export default function Overview() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: previous = [] } = usePreviousTransactions(range);
  const { data: buyPrices = [] } = useBuyPrices(90);

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
    filtered.forEach((t) => {
      if (t.date) map[t.date] = (map[t.date] || 0) + (t.cantidad || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, litres]) => ({ date: format(parseISO(date), "dd MMM"), litres }));
  }, [filtered]);

  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; litres: number }> = {};
    filtered.forEach((t) => {
      const name = t.nombre_cliente1 || "Unknown";
      if (!map[name]) map[name] = { name, litres: 0 };
      map[name].litres += t.cantidad || 0;
    });
    return Object.values(map)
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 6);
  }, [filtered]);

  const priceData = useMemo(() => {
    return [...buyPrices]
      .sort((a, b) => a.price_date.localeCompare(b.price_date))
      .map((p) => ({
        date: format(parseISO(p.price_date), "dd MMM"),
        price: p.price_per_litre,
      }));
  }, [buyPrices]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-3">
        <Droplets className="w-6 h-6" />
        <p className="text-sm">
          No transactions. Click <strong className="text-foreground">Sync Now</strong> to pull data.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 max-w-[1200px]">
      {/* HERO SECTION */}
      <div
        style={{
          background: "#0d0d0d",
          border: "1px solid #161616",
          borderRadius: 12,
          padding: "28px 32px 0 32px",
          overflow: "hidden",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-4">
          <div>
            <div className="text-[11px] text-[#999999] uppercase tracking-wider mb-1.5">
              Total Litres Delivered
            </div>
            <div className="text-4xl sm:text-[56px] font-light text-white tracking-tighter leading-none tabular-nums">
              {totalLitres >= 1000 ? `${(totalLitres / 1000).toFixed(2)}k L` : `${totalLitres.toFixed(1)} L`}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5">
              {litresPct >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className={`text-xs font-medium ${litresPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {litresPct >= 0 ? "+" : ""}{litresPct.toFixed(1)}%
              </span>
              <span className="text-xs text-[#999999]">vs previous period</span>
            </div>
          </div>

          <div className="flex gap-8 pt-1">
            {[
              { label: "Revenue", value: "$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), p: revPct },
              { label: "Deliveries", value: numDeliveries.toString(), p: delPct },
              { label: "Avg Size", value: Math.round(avgSize) + "L", p: avgPct },
            ].map((k) => (
              <div key={k.label} className="text-right">
                <div className="text-[10px] text-[#999999] uppercase tracking-wider mb-1">{k.label}</div>
                <div className="text-xl font-medium text-white tracking-tight tabular-nums">{k.value}</div>
                <div className={`text-[11px] mt-0.5 ${k.p >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {k.p >= 0 ? "+" : ""}{k.p.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 160, marginLeft: -32, marginRight: -32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="litresGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, color: "#fff", fontSize: 12 }}
                formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="litres" stroke="#ffffff" strokeWidth={1.5} fill="url(#litresGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DAILY VOLUME - FULL WIDTH */}
      <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: 12, padding: "20px 24px", marginTop: 1 }}>
        <div className="text-sm font-medium text-white mb-1">Daily Volume</div>
        <div className="text-[11px] text-[#999999] mb-4">Litres delivered per day</div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} barCategoryGap="30%">
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, color: "#fff", fontSize: 11 }}
                formatter={(v: number) => [`${v.toLocaleString()}L`, ""]}
                cursor={{ fill: "rgba(255,255,255,0.02)" }}
              />
              <Bar dataKey="litres" fill="#7C3AED" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BOTTOM TWO PANELS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1px] mt-[1px]">
        {/* Top Customers Pie */}
        <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: 12, padding: "20px 24px" }}>
          <div className="text-sm font-medium text-white mb-1">Top Customers</div>
          <div className="text-[11px] text-[#999999] mb-4">Volume share by customer</div>
          <div className="flex items-center gap-4" style={{ height: 260 }}>
            <div style={{ width: 180, height: "100%", flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topCustomers}
                    dataKey="litres"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    strokeWidth={0}
                  >
                    {topCustomers.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, color: "#fff", fontSize: 11 }}
                    formatter={(v: number) => [`${(v / 1000).toFixed(1)}k L`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              {topCustomers.map((c, i) => {
                const total = topCustomers.reduce((s, x) => s + x.litres, 0);
                const pctVal = total > 0 ? ((c.litres / total) * 100).toFixed(0) : "0";
                return (
                  <div key={c.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-[#ccc] truncate flex-1">{c.name}</span>
                    <span className="text-xs text-[#999] tabular-nums shrink-0">{pctVal}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Buy Price Trend */}
        <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: 12, padding: "20px 24px" }}>
          <div className="text-sm font-medium text-white mb-1">Fuel Buy Price</div>
          <div className="text-[11px] text-[#999999] mb-4">Supply price trend ($/L)</div>
          <div style={{ height: 260 }}>
            {priceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} width={50} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, color: "#fff", fontSize: 11 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}/L`, "Price"]}
                  />
                  <Line type="monotone" dataKey="price" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[#999999] text-xs">
                No price data yet. Add prices in Finance → Buy Price.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
