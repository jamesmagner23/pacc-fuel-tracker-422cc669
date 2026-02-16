import { useMemo } from "react";
import { Droplets, Truck, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useClientTransactions } from "@/hooks/useClientTransactions";
import { useAuth } from "@/hooks/useAuth";
import { KPICard } from "@/components/KPICard";
import { format, parseISO } from "date-fns";
import type { PortalDateRange } from "@/components/PortalLayout";

export default function PortalOverview({ dateRange }: { dateRange: PortalDateRange }) {
  const { companyName } = useAuth();
  const { data: txns = [], isLoading } = useClientTransactions(dateRange);

  const totalLitres = txns.reduce((s, t) => s + (t.cantidad || 0), 0);
  const numDeliveries = txns.length;
  const avgSize = numDeliveries > 0 ? totalLitres / numDeliveries : 0;

  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    txns.forEach((t) => { if (t.date) map[t.date] = (map[t.date] || 0) + (t.cantidad || 0); });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, litres]) => ({ date: format(parseISO(date), "dd/MM"), litres }));
  }, [txns]);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Welcome, {companyName}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KPICard title="Total Litres" value={totalLitres.toLocaleString() + " L"} change={0} icon={<Droplets className="w-4 h-4" />} delay={0} />
        <KPICard title="Deliveries" value={numDeliveries.toString()} change={0} icon={<Truck className="w-4 h-4" />} delay={50} />
        <KPICard title="Avg Delivery" value={Math.round(avgSize).toLocaleString() + " L"} change={0} icon={<BarChart3 className="w-4 h-4" />} delay={100} />
      </div>

      <div className="glass-card p-4 sm:p-5 animate-fade-in" style={{ animationDelay: "150ms" }}>
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Daily Litres Delivered</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(217 33% 17%)", border: "1px solid hsl(217 33% 25%)", borderRadius: "8px", color: "hsl(210 40% 98%)", fontSize: 12 }} formatter={(value: number) => [`${value.toLocaleString()} L`, "Litres"]} />
              <Bar dataKey="litres" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
        <p className="text-sm text-muted-foreground">
          Your fuel is delivered by <strong className="text-foreground">PACC Fuel</strong>. For orders or enquiries, contact us any time.
        </p>
      </div>
    </div>
  );
}
