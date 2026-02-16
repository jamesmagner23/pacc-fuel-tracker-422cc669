import { useMemo } from "react";
import { Wrench } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useClientTransactions } from "@/hooks/useClientTransactions";
import type { PortalDateRange } from "@/components/PortalLayout";

export default function PortalEquipment({ dateRange }: { dateRange: PortalDateRange }) {
  const { data: txns = [], isLoading } = useClientTransactions(dateRange);

  const equipment = useMemo(() => {
    const map: Record<string, { plate: string; litres: number; fills: number }> = {};
    txns.forEach((t) => {
      const plate = t.placa || "Unknown";
      if (!map[plate]) map[plate] = { plate, litres: 0, fills: 0 };
      map[plate].litres += t.cantidad || 0;
      map[plate].fills += 1;
    });
    return Object.values(map).sort((a, b) => b.litres - a.litres);
  }, [txns]);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold">Equipment / Assets</h1>

      <div className="glass-card p-4 sm:p-5 animate-fade-in">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Top 10 Equipment by Volume</h2>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={equipment.slice(0, 10)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="plate" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} width={120} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(217 33% 17%)", border: "1px solid hsl(217 33% 25%)", borderRadius: "8px", color: "hsl(210 40% 98%)", fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString()} L`, "Litres"]} />
              <Bar dataKey="litres" fill="hsl(25 95% 53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2">
        {equipment.map((eq, i) => (
          <div
            key={eq.plate}
            className="glass-card p-4 flex items-center justify-between animate-fade-in"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div className="flex items-center gap-3">
              <Wrench className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm font-mono">{eq.plate}</span>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-sm font-bold">{eq.litres.toLocaleString()} L</div>
                <div className="text-[10px] text-muted-foreground">Volume</div>
              </div>
              <div>
                <div className="text-sm font-bold">{eq.fills}</div>
                <div className="text-[10px] text-muted-foreground">Fills</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
