import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useDateRange } from "@/hooks/useDateRange";
import { transactions, customerList, filterByDateRange } from "@/data/mockData";

export default function Customers() {
  const { range } = useDateRange();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => filterByDateRange(transactions, range), [range]);

  const customerStats = useMemo(() => {
    const map: Record<string, { litres: number; deliveries: number; revenue: number }> = {};
    filtered.forEach((t) => {
      if (!map[t.nombre_cliente1]) map[t.nombre_cliente1] = { litres: 0, deliveries: 0, revenue: 0 };
      map[t.nombre_cliente1].litres += t.cantidad;
      map[t.nombre_cliente1].deliveries += 1;
      map[t.nombre_cliente1].revenue += t.dinero_total;
    });
    return map;
  }, [filtered]);

  const rows = customerList
    .map((c) => ({
      ...c,
      litres: customerStats[c.name]?.litres || 0,
      deliveries: customerStats[c.name]?.deliveries || 0,
      revenue: customerStats[c.name]?.revenue || 0,
    }))
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.litres - a.litres);

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-bold">Customers</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="space-y-2">
        {rows.map((c, i) => (
          <button
            key={c.code}
            onClick={() => navigate(`/customers/${encodeURIComponent(c.name)}`)}
            className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors text-left animate-fade-in"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div>
              <div className="font-semibold text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.code}</div>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-sm font-bold">{c.litres.toLocaleString()}L</div>
                <div className="text-[10px] text-muted-foreground">Volume</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold">{c.deliveries}</div>
                <div className="text-[10px] text-muted-foreground">Deliveries</div>
              </div>
              <div>
                <div className="text-sm font-bold">${c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="text-[10px] text-muted-foreground">Revenue</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
