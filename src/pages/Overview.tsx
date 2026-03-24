import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { format, parseISO } from "date-fns";
import { Droplets, TrendingUp, TrendingDown, Clock, Truck, MapPin, Fuel } from "lucide-react";

const PIE_COLORS = ["#E8461E", "#FF6B42", "#FFB088", "#D13A14", "#CC6B3A", "#8B5A2B"];

function DonutCard({ topCustomers }: { topCustomers: { name: string; litres: number }[] }) {
  const [showPct, setShowPct] = useState(false);
  const total = topCustomers.reduce((s, x) => s + x.litres, 0);

  return (
    <div style={{ background: "#4A3525", border: "1px solid #6B5240", borderRadius: 12, padding: "20px 24px" }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium text-foreground">Top Customers</div>
        <button
          onClick={() => setShowPct((p) => !p)}
          className="text-[10px] px-2 py-0.5 rounded-full border transition-colors"
          style={{
            borderColor: "#C4A882",
            color: "#D4C4A8",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          {showPct ? "Show Litres" : "Show %"}
        </button>
      </div>
      <div className="text-[11px] text-[#D4C4A8] mb-4">Volume share by customer</div>
      {/* Stacked on mobile, side-by-side on desktop */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-[180px] shrink-0" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={topCustomers}
                dataKey="litres"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={40}
                strokeWidth={0}
              >
                {topCustomers.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#4A3525", border: "1px solid #6B5240", borderRadius: 8, color: "#F5E6D0", fontSize: 11 }}
                formatter={(v: number) => {
                  const pctVal = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                  return [`${(v / 1000).toFixed(1)}k L (${pctVal}%)`, ""];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2 min-w-0 w-full sm:flex-1">
          {topCustomers.map((c, i) => {
            const pctVal = total > 0 ? ((c.litres / total) * 100).toFixed(0) : "0";
            return (
              <div key={c.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-xs text-[#E0D0B8] flex-1">{c.name}</span>
                <span className="text-xs text-[#D4C4A8] tabular-nums shrink-0">
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

  const hourlyData = useMemo(() => {
    if (range !== "today") return [];
    const hours: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hours[h] = 0;
    filtered.forEach((t) => {
      const hour = new Date(t.fecha).getHours();
      hours[hour] += t.cantidad || 0;
    });
    return Object.entries(hours)
      .map(([h, litres]) => ({
        hour: `${String(h).padStart(2, "0")}:00`,
        litres,
      }))
      .filter((_, i) => i >= 5 && i <= 22); // 5am to 10pm
  }, [filtered, range]);

  const recentDeliveries = useMemo(() => {
    if (range !== "today") return [];
    return [...filtered]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 12);
  }, [filtered, range]);

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
          background: "#4A3525",
          border: "1px solid #6B5240",
          borderRadius: 12,
          padding: "28px 32px 0 32px",
          overflow: "hidden",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-4">
          <div>
            <div className="text-[11px] text-[#D4C4A8] uppercase tracking-wider mb-1.5">
              Total Litres Delivered
            </div>
            <div className="text-4xl sm:text-[56px] font-light text-foreground tracking-tighter leading-none tabular-nums">
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
              <span className="text-xs text-[#D4C4A8]">vs previous period</span>
            </div>
          </div>

          <div className="flex gap-8 pt-1">
            {[
              { label: "Revenue", value: "$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), p: revPct },
              { label: "Deliveries", value: numDeliveries.toString(), p: delPct },
              { label: "Avg Size", value: Math.round(avgSize) + "L", p: avgPct },
            ].map((k) => (
              <div key={k.label} className="text-right">
                <div className="text-[10px] text-[#D4C4A8] uppercase tracking-wider mb-1">{k.label}</div>
                <div className="text-xl font-medium text-foreground tracking-tight tabular-nums">{k.value}</div>
                <div className={`text-[11px] mt-0.5 ${k.p >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {k.p >= 0 ? "+" : ""}{k.p.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero chart: area chart for all ranges */}
        <div style={{ height: 160, marginLeft: -32, marginRight: -32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="litresGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8461E" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#E8461E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#C4A882" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#4A3525", border: "1px solid #6B5240", borderRadius: 8, color: "#F5E6D0", fontSize: 12 }}
                formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="litres" stroke="#E8461E" strokeWidth={1.5} fill="url(#litresGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TODAY: Live Delivery Feed | OTHER: Daily Volume Bar Chart */}
      {range === "today" ? (
        <div style={{ background: "#4A3525", border: "1px solid #6B5240", borderRadius: 12, padding: "20px 24px", marginTop: 1 }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-primary" />
            <div className="text-sm font-medium text-foreground">Today's Deliveries</div>
          </div>
          <div className="text-[11px] text-[#D4C4A8] mb-4">Live feed — most recent first</div>
          {recentDeliveries.length === 0 ? (
            <div className="text-center text-[#C4A882] text-xs py-8">No deliveries recorded today yet.</div>
          ) : (
            <div className="flex flex-col divide-y divide-[#6B5240]">
              {recentDeliveries.map((t) => (
                <div key={t.id} className="flex items-start gap-2 sm:gap-3 py-2.5 group hover:bg-[#5A4535] -mx-3 px-3 rounded-lg transition-colors">
                  <div className="w-[40px] sm:w-[52px] text-[11px] text-[#C4A882] tabular-nums shrink-0 pt-0.5">
                    {format(new Date(t.fecha), "HH:mm")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground font-medium truncate">
                      {t.nombre_cliente1 || "Walk-in"}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-[#C4A882] mt-0.5">
                      {t.placa && (
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          {t.placa}
                        </span>
                      )}
                      {t.estacion && (
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <MapPin className="w-3 h-3" />
                          {t.estacion}
                        </span>
                      )}
                      {t.producto && (
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <Fuel className="w-3 h-3" />
                          {t.producto}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-foreground font-semibold tabular-nums">
                      {(t.cantidad || 0).toLocaleString()}L
                    </div>
                    {t.dinero_total != null && (
                      <div className="text-[11px] text-[#C4A882] tabular-nums hidden sm:block">
                        ${t.dinero_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "#4A3525", border: "1px solid #6B5240", borderRadius: 12, padding: "20px 24px", marginTop: 1 }}>
          <div className="text-sm font-medium text-foreground mb-1">Daily Volume</div>
          <div className="text-[11px] text-[#D4C4A8] mb-4">Litres delivered per day</div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} barCategoryGap="30%">
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#C4A882" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#C4A882" }} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  contentStyle={{ background: "#4A3525", border: "1px solid #6B5240", borderRadius: 8, color: "#F5E6D0", fontSize: 11 }}
                  formatter={(v: number) => [`${v.toLocaleString()}L`, ""]}
                  cursor={{ fill: "rgba(255,255,255,0.02)" }}
                />
                <Bar dataKey="litres" fill="#E8461E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* BOTTOM TWO PANELS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1px] mt-[1px]">
        {/* Top Customers Pie */}
        <DonutCard topCustomers={topCustomers} />

        {/* Buy Price Trend */}
        <div style={{ background: "#4A3525", border: "1px solid #6B5240", borderRadius: 12, padding: "20px 24px" }}>
          <div className="text-sm font-medium text-foreground mb-1">Fuel Buy Price</div>
          <div className="text-[11px] text-[#D4C4A8] mb-4">Supply price trend ($/L)</div>
          <div style={{ height: 260 }}>
            {priceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#C4A882" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#C4A882" }} axisLine={false} tickLine={false} width={50} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#4A3525", border: "1px solid #6B5240", borderRadius: 8, color: "#F5E6D0", fontSize: 11 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}/L`, "Price"]}
                  />
                  <Line type="monotone" dataKey="price" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[#D4C4A8] text-xs">
                No price data yet. Add prices in Finance → Buy Price.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
