import { useMemo } from "react";
import { Droplets, DollarSign, Truck, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { transactions, filterByDateRange, getPreviousPeriodTransactions } from "@/data/mockData";
import { KPICard } from "@/components/KPICard";
import { format, parseISO } from "date-fns";

export default function Overview() {
  const { range } = useDateRange();

  const filtered = useMemo(() => filterByDateRange(transactions, range), [range]);
  const previous = useMemo(() => getPreviousPeriodTransactions(transactions, range), [range]);

  const totalLitres = filtered.reduce((s, t) => s + t.litres, 0);
  const totalRevenue = filtered.reduce((s, t) => s + t.total, 0);
  const numDeliveries = filtered.length;
  const avgSize = numDeliveries > 0 ? totalLitres / numDeliveries : 0;

  const prevLitres = previous.reduce((s, t) => s + t.litres, 0);
  const prevRevenue = previous.reduce((s, t) => s + t.total, 0);
  const prevDeliveries = previous.length;
  const prevAvg = prevDeliveries > 0 ? prevLitres / prevDeliveries : 0;

  const pctChange = (curr: number, prev: number) =>
    prev === 0 ? 100 : ((curr - prev) / prev) * 100;

  // Daily chart data
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => {
      map[t.date] = (map[t.date] || 0) + t.litres;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, litres]) => ({
        date: format(parseISO(date), "dd MMM"),
        litres,
      }));
  }, [filtered]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; litres: number }> = {};
    filtered.forEach((t) => {
      if (!map[t.customerId]) map[t.customerId] = { name: t.customerName, litres: 0 };
      map[t.customerId].litres += t.litres;
    });
    return Object.values(map)
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 5);
  }, [filtered]);

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-xl font-bold">Overview</h1>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          title="Total Litres"
          value={totalLitres.toLocaleString() + "L"}
          change={pctChange(totalLitres, prevLitres)}
          icon={<Droplets className="w-4 h-4" />}
          delay={0}
        />
        <KPICard
          title="Revenue"
          value={"$" + totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          change={pctChange(totalRevenue, prevRevenue)}
          icon={<DollarSign className="w-4 h-4" />}
          delay={50}
        />
        <KPICard
          title="Deliveries"
          value={numDeliveries.toString()}
          change={pctChange(numDeliveries, prevDeliveries)}
          icon={<Truck className="w-4 h-4" />}
          delay={100}
        />
        <KPICard
          title="Avg Delivery"
          value={Math.round(avgSize).toLocaleString() + "L"}
          change={pctChange(avgSize, prevAvg)}
          icon={<BarChart3 className="w-4 h-4" />}
          delay={150}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Chart */}
        <div className="glass-card p-4 sm:p-5 lg:col-span-2 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Daily Litres Delivered</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(217 33% 17%)",
                    border: "1px solid hsl(217 33% 25%)",
                    borderRadius: "8px",
                    color: "hsl(210 40% 98%)",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()}L`, "Litres"]}
                />
                <Bar dataKey="litres" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers */}
        <div className="glass-card p-4 sm:p-5 animate-fade-in" style={{ animationDelay: "250ms" }}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Top Customers by Volume</h2>
          <div className="space-y-3">
            {topCustomers.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{
                        width: `${(c.litres / (topCustomers[0]?.litres || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
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
