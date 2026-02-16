import { useMemo, useState } from "react";
import { useDateRange } from "@/hooks/useDateRange";
import { transactions, allProjects, filterByDateRange } from "@/data/mockData";

export default function Projects() {
  const { range } = useDateRange();
  const [sortBy, setSortBy] = useState<"volume" | "recent">("volume");

  const filtered = useMemo(() => filterByDateRange(transactions, range), [range]);

  const projectStats = useMemo(() => {
    const map: Record<string, { litres: number; deliveries: number; lastDate: string }> = {};
    filtered.forEach((t) => {
      if (!map[t.projectId]) map[t.projectId] = { litres: 0, deliveries: 0, lastDate: "" };
      map[t.projectId].litres += t.litres;
      map[t.projectId].deliveries += 1;
      if (t.date > map[t.projectId].lastDate) map[t.projectId].lastDate = t.date;
    });
    return map;
  }, [filtered]);

  const rows = allProjects
    .map((p) => ({
      ...p,
      litres: projectStats[p.id]?.litres || 0,
      deliveries: projectStats[p.id]?.deliveries || 0,
      lastDate: projectStats[p.id]?.lastDate || "",
    }))
    .sort((a, b) =>
      sortBy === "volume" ? b.litres - a.litres : b.lastDate.localeCompare(a.lastDate)
    );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Projects</h1>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(["volume", "recent"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                sortBy === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "volume" ? "By Volume" : "Most Recent"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((p, i) => (
          <div
            key={p.id}
            className="glass-card p-4 animate-fade-in"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div className="font-semibold text-sm">{p.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{p.customerName}</div>
            <div className="flex gap-6 mt-3">
              <div>
                <div className="text-lg font-bold">{p.litres.toLocaleString()}L</div>
                <div className="text-[10px] text-muted-foreground">Total Litres</div>
              </div>
              <div>
                <div className="text-lg font-bold">{p.deliveries}</div>
                <div className="text-[10px] text-muted-foreground">Deliveries</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
