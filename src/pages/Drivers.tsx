import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions } from "@/hooks/useTransactions";
import { format, parseISO } from "date-fns";

export default function Drivers() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);

  const tooltipStyle = { backgroundColor: "hsl(217 33% 17%)", border: "1px solid hsl(217 33% 25%)", borderRadius: "8px", color: "hsl(210 40% 98%)", fontSize: 12 };

  const drivers = useMemo(() => {
    return [...new Set(filtered.map((t) => t.nombre_vendedor).filter(Boolean))] as string[];
  }, [filtered]);

  const comparisonData = useMemo(() => {
    return drivers.map((d) => ({
      name: d,
      litres: filtered.filter((t) => t.nombre_vendedor === d).reduce((s, t) => s + (t.cantidad || 0), 0),
    }));
  }, [filtered, drivers]);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold">Drivers</h1>

      {drivers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No driver data. Click <strong>Sync Now</strong> to pull data.</div>
      ) : (
        <>
          <div className="glass-card p-4 sm:p-5 animate-fade-in">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4">Driver Comparison — Total Litres</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                  <Bar dataKey="litres" fill="#FF4D1C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {drivers.map((driver, i) => {
              const driverTxns = filtered.filter((t) => t.nombre_vendedor === driver);
              const totalLitres = driverTxns.reduce((s, t) => s + (t.cantidad || 0), 0);
              const avgSize = driverTxns.length > 0 ? Math.round(totalLitres / driverTxns.length) : 0;
              const trucksUsed = [...new Set(driverTxns.map((t) => t.estacion).filter(Boolean))];

              const dailyMap: Record<string, number> = {};
              driverTxns.forEach((t) => { if (t.date) dailyMap[t.date] = (dailyMap[t.date] || 0) + (t.cantidad || 0); });
              const dailyData = Object.entries(dailyMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, litres]) => ({ date: format(parseISO(date), "dd MMM"), litres }));

              return (
                <div key={driver} className="glass-card p-4 sm:p-5 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="mb-4">
                    <div className="font-semibold text-sm">{driver}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Trucks: {trucksUsed.join(", ") || "—"}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div>
                      <div className="text-lg font-bold">{(totalLitres / 1000).toFixed(1)}k</div>
                      <div className="text-[10px] text-muted-foreground">Total (L)</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{driverTxns.length}</div>
                      <div className="text-[10px] text-muted-foreground">Deliveries</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{avgSize.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">Avg (L)</div>
                    </div>
                  </div>

                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyData}>
                        <defs>
                          <linearGradient id={`grad-driver-${i}`} x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#FF4D1C" stopOpacity={0.3} />
                             <stop offset="100%" stopColor="#FF4D1C" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
                        <Area type="monotone" dataKey="litres" stroke="#FF4D1C" fill={`url(#grad-driver-${i})`} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
