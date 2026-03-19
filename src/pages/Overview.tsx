cat > src/pages/Overview.tsx << 'EOF'
import { useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { format, parseISO } from "date-fns";
import { Droplets, TrendingUp, TrendingDown } from "lucide-react";

export default function Overview() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: previous = [] } = usePreviousTransactions(range);

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const totalRevenue = filtered.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const numDeliveries = filtered.length;
  const avgSize = numDeliveries > 0 ? totalLitres / numDeliveries : 0;

  const prevLitres = previous.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevRevenue = previous.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const prevDeliveries = previous.length;

  const pct = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

  const litresPct = pct(totalLitres, prevLitres);
  const revPct = pct(totalRevenue, prevRevenue);
  const delPct = pct(numDeliveries, prevDeliveries);

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
    return Object.values(map).sort((a, b) => b.litres - a.litres).slice(0, 6);
  }, [filtered]);

  const recentTx = useMemo(() => [...filtered].reverse().slice(0, 8), [filtered]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#333333", fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "#333333", gap: 12 }}>
        <Droplets style={{ width: 24, height: 24 }} />
        <p style={{ fontSize: 13, margin: 0 }}>No transactions. Click <strong style={{ color: "#555555" }}>Sync Now</strong> to pull data.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, maxWidth: 1200 }}>

      {/* ── HERO SECTION ── */}
      <div style={{
        background: "#0d0d0d",
        border: "1px solid #161616",
        borderRadius: 12,
        padding: "28px 32px 0 32px",
        overflow: "hidden",
      }}>
        {/* Top row: label + secondary stats */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "#444444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Total Litres Delivered
            </div>
            {/* Giant hero number */}
            <div style={{ fontSize: 56, fontWeight: 300, color: "#ffffff", letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {totalLitres >= 1000
                ? `${(totalLitres / 1000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}k L`
                : `${totalLitres.toFixed(1)} L`}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
              {litresPct >= 0
                ? <TrendingUp style={{ width: 12, height: 12, color: "#10B981" }} />
                : <TrendingDown style={{ width: 12, height: 12, color: "#EF4444" }} />
              }
              <span style={{ fontSize: 12, color: litresPct >= 0 ? "#10B981" : "#EF4444", fontWeight: 500 }}>
                {litresPct >= 0 ? "+" : ""}{litresPct.toFixed(1)}%
              </span>
              <span style={{ fontSize: 12, color: "#333333" }}>vs previous period</span>
            </div>
          </div>

          {/* Secondary KPIs top-right */}
          <div style={{ display: "flex", gap: 32, paddingTop: 4 }}>
            {[
              { label: "Revenue", value: "$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), pct: revPct },
              { label: "Deliveries", value: numDeliveries.toString(), pct: delPct },
              { label: "Avg Size", value: Math.round(avgSize) + "L", pct: pct(avgSize, prevLitres > 0 ? prevLitres / (prevDeliveries || 1) : 0) },
            ].map((k) => (
              <div key={k.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#333333", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: "#ffffff", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                <div style={{ fontSize: 11, color: k.pct >= 0 ? "#10B981" : "#EF4444", marginTop: 2 }}>
                  {k.pct >= 0 ? "+" : ""}{k.pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full-width area chart — no padding on sides so it bleeds to edges */}
        <div style={{ height: 160, marginLeft: -32, marginRight: -32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="litresGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#333333" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#111111", border: "1px solid #222222", borderRadius: 8, color: "#fff", fontSize: 12 }}
                formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="litres" stroke="#ffffff" strokeWidth={1.5} fill="url(#litresGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── BOTTOM THREE PANELS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, marginTop: 1 }}>

        {/* Panel 1: Top Customers */}
        <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#ffffff", marginBottom: 4 }}>Top Customers</div>
          <div style={{ fontSize: 11, color: "#333333", marginBottom: 16 }}>{numDeliveries} deliveries this period</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {topCustomers.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < topCustomers.length - 1 ? "1px solid #131313" : "none" }}>
                <span style={{ fontSize: 10, color: "#2a2a2a", width: 14, flexShrink: 0, fontWeight: 600 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#cccccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{c.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#888888", fontVariantNumeric: "tabular-nums" }}>{(c.litres / 1000).toFixed(1)}k L</div>
                  <div style={{ width: 60, height: 2, background: "#1a1a1a", borderRadius: 2, marginTop: 4, marginLeft: "auto" }}>
                    <div style={{ width: `${(c.litres / (topCustomers[0]?.litres || 1)) * 100}%`, height: 2, background: "#ffffff", borderRadius: 2, opacity: 0.4 + (0.6 * (1 - i / topCustomers.length)) }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Volume by day (bar chart) */}
        <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#ffffff", marginBottom: 4 }}>Daily Volume</div>
          <div style={{ fontSize: 11, color: "#333333", marginBottom: 16 }}>Litres per day</div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} barCategoryGap="40%">
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#333333" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#111111", border: "1px solid #222222", borderRadius: 8, color: "#fff", fontSize: 11 }}
                  formatter={(v: number) => [`${v.toLocaleString()}L`, ""]}
                  cursor={{ fill: "rgba(255,255,255,0.02)" }}
                />
                <Bar dataKey="litres" fill="#7C3AED" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel 3: Recent transactions */}
        <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#ffffff" }}>Transactions</div>
            <a href="/transactions" style={{ fontSize: 11, color: "#333333", textDecoration: "none" }}>View all →</a>
          </div>
          <div style={{ fontSize: 11, color: "#333333", marginBottom: 16 }}>Most recent</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {recentTx.map((t, i) => (
              <div key={t.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < recentTx.length - 1 ? "1px solid #131313" : "none" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#cccccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                    {t.nombre_cliente1 || "Unknown"}
                  </div>
                  <div style={{ fontSize: 10, color: "#333333", marginTop: 1 }}>
                    {t.date ? format(parseISO(t.date), "dd MMM") : "—"}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: "#888888", fontVariantNumeric: "tabular-nums" }}>
                    {(t.cantidad || 0).toLocaleString()}L
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
EOF
echo "✅ Overview done"