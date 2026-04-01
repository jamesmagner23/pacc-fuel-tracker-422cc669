import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, useAllTransactions } from "@/hooks/useTransactions";
import { format, parseISO, subDays } from "date-fns";

const knownCapacities: Record<string, number> = {
  "PACC Truck 1": 8000,
  "PACC Truck 2": 5000,
  "PACC Truck 3": 4000,
};

function cssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function Trucks() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: allTxns = [] } = useAllTransactions();

  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const surface = cssVar("--surface", "#4A3525");
  const border = cssVar("--surface-border", "#6B5240");
  const textPrimary = cssVar("--text-primary", "#F5E6D0");
  const textSecondary = cssVar("--text-secondary", "#C4A882");
  const accent = cssVar("--accent", "#E8461E");

  const tooltipStyle = { backgroundColor: surface, border: `1px solid ${border}`, borderRadius: "8px", fontSize: 12 };
  const tooltipLabelStyle = { color: textPrimary };
  const tooltipItemStyle = { color: textPrimary };

  const trucks = useMemo(() => {
    const fromData = [...new Set(allTxns.map((t) => t.estacion).filter(Boolean))] as string[];
    return fromData.map((name) => ({
      name,
      capacity: knownCapacities[name] || 0,
      plate: name.replace(/\s+/g, "").toUpperCase(),
    }));
  }, [allTxns]);

  const comparisonData = useMemo(() => {
    return trucks.map((t) => ({
      name: t.name,
      litres: filtered.filter((tx) => tx.estacion === t.name).reduce((s, tx) => s + (tx.cantidad || 0), 0),
    }));
  }, [filtered, trucks]);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold">Trucks</h1>

      <div className="glass-card p-4 sm:p-5 animate-fade-in">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Truck Comparison — Total Litres</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: textSecondary }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: textSecondary }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
              <Bar dataKey="litres" fill={accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {trucks.map((truck, i) => {
          const truckTxns = filtered.filter((t) => t.estacion === truck.name);
          const todayLitres = allTxns.filter((t) => t.estacion === truck.name && t.date === today).reduce((s, t) => s + (t.cantidad || 0), 0);
          const weekLitres = allTxns.filter((t) => t.estacion === truck.name && t.date && t.date >= weekAgo).reduce((s, t) => s + (t.cantidad || 0), 0);
          const periodLitres = truckTxns.reduce((s, t) => s + (t.cantidad || 0), 0);
          const avgSize = truckTxns.length > 0 ? Math.round(periodLitres / truckTxns.length) : 0;

          const latestTotaliser = allTxns.find((t) => t.estacion === truck.name)?.totalizador_bruto || 0;

          const dailyMap: Record<string, number> = {};
          truckTxns.forEach((t) => { if (t.date) dailyMap[t.date] = (dailyMap[t.date] || 0) + (t.cantidad || 0); });
          const dailyData = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, litres]) => ({ date: format(parseISO(date), "dd"), litres }));

          return (
            <div key={truck.name} className="glass-card p-4 sm:p-5 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-semibold text-sm">{truck.name}</div>
                  {truck.capacity > 0 && <div className="text-xs text-muted-foreground">{truck.capacity.toLocaleString()}L capacity</div>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Totaliser</div>
                  <div className="text-xs font-mono font-medium">{latestTotaliser.toLocaleString()}L</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div>
                  <div className="text-lg font-bold">{todayLitres.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Today (L)</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{(weekLitres / 1000).toFixed(1)}k</div>
                  <div className="text-[10px] text-muted-foreground">Week (L)</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{(periodLitres / 1000).toFixed(1)}k</div>
                  <div className="text-[10px] text-muted-foreground">Period (L)</div>
                </div>
              </div>

              <div className="h-28 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id={`grad-${truck.plate}`} x1="0" y1="0" x2="0" y2="1">
                         <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
                         <stop offset="100%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: textSecondary }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="litres" stroke={accent} fill={`url(#grad-${truck.plate})`} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{truckTxns.length} deliveries</span>
                <span>Avg {avgSize.toLocaleString()}L</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
