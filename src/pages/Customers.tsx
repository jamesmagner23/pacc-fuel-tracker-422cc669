import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useDateRange } from "@/hooks/useDateRange";
import { transactions, customers, filterByDateRange } from "@/data/mockData";

export default function Customers() {
  const { range } = useDateRange();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => filterByDateRange(transactions, range), [range]);

  const customerStats = useMemo(() => {
    const map: Record<string, { litres: number; deliveries: number; revenue: number }> = {};
    filtered.forEach((t) => {
      if (!map[t.customerId]) map[t.customerId] = { litres: 0, deliveries: 0, revenue: 0 };
      map[t.customerId].litres += t.litres;
      map[t.customerId].deliveries += 1;
      map[t.customerId].revenue += t.total;
    });
    return map;
  }, [filtered]);

  const rows = customers
    .map((c) => ({
      ...c,
      litres: customerStats[c.id]?.litres || 0,
      deliveries: customerStats[c.id]?.deliveries || 0,
      revenue: customerStats[c.id]?.revenue || 0,
    }))
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.litres - a.litres);

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-bold">Customers</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="space-y-2">
        {rows.map((c, i) => (
          <button
            key={c.id}
            onClick={() => navigate(`/customers/${c.id}`)}
            className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors text-left animate-fade-in"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div>
              <div className="font-semibold text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {c.projects.length} project{c.projects.length !== 1 ? "s" : ""}
              </div>
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
                <div className="text-sm font-bold">
                  ${c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-muted-foreground">Revenue</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
