import { Droplets, DollarSign, Truck, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { KPICard } from "@/components/KPICard";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";

const card = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: 10,
  padding: "18px 20px",
} as React.CSSProperties;

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
  const prevAvg = prevDeliveries > 0 ? prevLitres / prevDeliveries : 0;

  const pctChange = (curr: number, prev: number) => (prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);

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
      .slice(0, 5);
  }, [filtered]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 256,
          color: "#444444",
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 256,
          color: "#444444",
          gap: 12,
        }}
      >
        <Droplets style={{ width: 28, height: 28 }} />
        <p style={{ fontSize: 13 }}>
          No transactions yet. Click <strong style={{ color: "#888888" }}>Sync Now</strong> to pull data from SCA WEB.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      {/* Page title */}
      <h1 style={{ fontSize: 18, fontWeight: 600, color: "#ffffff", letterSpacing: "-0.02em", margin: 0 }}>Overview</h1>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }} className="lg:grid-cols-4">
        <KPICard
          title="Total Litres"
          value={totalLitres.toLocaleString() + "L"}
          change={pctChange(totalLitres, prevLitres)}
          icon={<Droplets style={{ width: 14, height: 14 }} />}
          delay={0}
        />
        <KPICard
          title="Revenue"
          value={"$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          change={pctChange(totalRevenue, prevRevenue)}
          icon={<DollarSign style={{ width: 14, height: 14 }} />}
          delay={50}
        />
        <KPICard
          title="Deliveries"
          value={numDeliveries.toString()}
          change={pctChange(numDeliveries, prevDeliveries)}
          icon={<Truck style={{ width: 14, height: 14 }} />}
          delay={100}
        />
        <KPICard
          title="Avg Delivery"
          value={Math.round(avgSize).toLocaleString() + "L"}
          change={pctChange(avgSize, prevAvg)}
          icon={<BarChart3 style={{ width: 14, height: 14 }} />}
          delay={150}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }} className="grid-cols-1 lg:grid-cols-3">
        {/* Bar chart */}
        <div style={{ ...card, animationDelay: "200ms" }} className="animate-fade-in lg:col-span-2">
          <h2
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#444444",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 16,
              marginTop: 0,
            }}
          >
            Daily Litres Delivered
          </h2>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} barCategoryGap="35%">
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#444444" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#444444" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #7C3AED",
                    borderRadius: 8,
                    color: "#ffffff",
                    fontSize: 12,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()}L`, "Litres"]}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="litres" fill="#7C3AED" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top customers */}
        <div style={{ ...card, animationDelay: "250ms" }} className="animate-fade-in">
          <h2
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#444444",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 16,
              marginTop: 0,
            }}
          >
            Top Customers
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topCustomers.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#333333", width: 16, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#cccccc",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginBottom: 5,
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ width: "100%", background: "#1a1a1a", borderRadius: 4, height: 3 }}>
                    <div
                      style={{
                        background: "#7C3AED",
                        height: 3,
                        borderRadius: 4,
                        width: `${(c.litres / (topCustomers[0]?.litres || 1)) * 100}%`,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#555555", whiteSpace: "nowrap" }}>
                  {(c.litres / 1000).toFixed(1)}k L
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
