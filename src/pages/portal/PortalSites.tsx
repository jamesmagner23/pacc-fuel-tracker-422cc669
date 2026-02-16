import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useClientTransactions } from "@/hooks/useClientTransactions";
import { format, parseISO } from "date-fns";
import type { PortalDateRange } from "@/components/PortalLayout";

export default function PortalSites({ dateRange }: { dateRange: PortalDateRange }) {
  const { data: txns = [], isLoading } = useClientTransactions(dateRange);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const sites = useMemo(() => {
    const map: Record<string, { name: string; litres: number; deliveries: number }> = {};
    txns.forEach((t) => {
      const name = t.ciudad || "Unknown";
      if (!map[name]) map[name] = { name, litres: 0, deliveries: 0 };
      map[name].litres += t.cantidad || 0;
      map[name].deliveries += 1;
    });
    return Object.values(map).sort((a, b) => b.litres - a.litres);
  }, [txns]);

  const siteHistory = useMemo(() => {
    if (!selectedSite) return [];
    return txns
      .filter((t) => t.ciudad === selectedSite)
      .map((t) => ({
        date: format(parseISO(t.fecha), "dd/MM/yyyy"),
        time: format(parseISO(t.fecha), "HH:mm"),
        equipment: t.placa || "—",
        litres: t.cantidad || 0,
      }));
  }, [txns, selectedSite]);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold">Sites / Locations</h1>

      <div className="glass-card p-4 sm:p-5 animate-fade-in">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Volume by Site</h2>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sites.slice(0, 10)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} width={120} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(217 33% 17%)", border: "1px solid hsl(217 33% 25%)", borderRadius: "8px", color: "hsl(210 40% 98%)", fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString()} L`, "Litres"]} />
              <Bar dataKey="litres" fill="hsl(25 95% 53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2">
        {sites.map((site, i) => (
          <button
            key={site.name}
            onClick={() => setSelectedSite(selectedSite === site.name ? null : site.name)}
            className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors text-left animate-fade-in"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{site.name}</span>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-sm font-bold">{site.litres.toLocaleString()} L</div>
                <div className="text-[10px] text-muted-foreground">Volume</div>
              </div>
              <div>
                <div className="text-sm font-bold">{site.deliveries}</div>
                <div className="text-[10px] text-muted-foreground">Deliveries</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedSite && siteHistory.length > 0 && (
        <div className="glass-card p-4 sm:p-5 animate-fade-in">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Delivery History — {selectedSite}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Equipment</th>
                  <th className="pb-2 text-right">Litres</th>
                </tr>
              </thead>
              <tbody>
                {siteHistory.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 pr-4">{row.date}</td>
                    <td className="py-2.5 pr-4">{row.time}</td>
                    <td className="py-2.5 pr-4">{row.equipment}</td>
                    <td className="py-2.5 text-right font-medium">{row.litres.toLocaleString()} L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
