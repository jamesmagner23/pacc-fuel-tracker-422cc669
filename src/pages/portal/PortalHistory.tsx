import { useMemo, useState } from "react";
import { Search, Download, ArrowUpDown } from "lucide-react";
import { useClientTransactions } from "@/hooks/useClientTransactions";
import { format, parseISO } from "date-fns";
import type { PortalDateRange } from "@/components/PortalLayout";

type SortKey = "fecha" | "ciudad" | "placa" | "cantidad";

export default function PortalHistory({ dateRange }: { dateRange: PortalDateRange }) {
  const { data: txns = [], isLoading } = useClientTransactions(dateRange);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortAsc, setSortAsc] = useState(false);

  const locations = useMemo(() => [...new Set(txns.map((t) => t.ciudad).filter(Boolean))].sort() as string[], [txns]);
  const equipments = useMemo(() => [...new Set(txns.map((t) => t.placa).filter(Boolean))].sort() as string[], [txns]);

  const filtered = useMemo(() => {
    let result = [...txns];
    if (locationFilter) result = result.filter((t) => t.ciudad === locationFilter);
    if (equipmentFilter) result = result.filter((t) => t.placa === equipmentFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        (t.ciudad || "").toLowerCase().includes(q) ||
        (t.placa || "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const av = a[sortKey as keyof typeof a];
      const bv = b[sortKey as keyof typeof b];
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av || "").localeCompare(String(bv || "")) : String(bv || "").localeCompare(String(av || ""));
    });
    return result;
  }, [txns, search, locationFilter, equipmentFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const exportCSV = () => {
    const headers = "Date,Time,Location,Equipment,Litres";
    const rows = filtered.map((t) =>
      `${format(parseISO(t.fecha), "dd/MM/yyyy")},${format(parseISO(t.fecha), "HH:mm")},"${t.ciudad || ""}","${t.placa || ""}",${t.cantidad || 0}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliveries-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, k, className = "" }: { label: string; k: SortKey; className?: string }) => (
    <th className={`p-3 pr-2 cursor-pointer hover:text-foreground transition-colors ${className}`} onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="w-3 h-3" /></span>
    </th>
  );

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Delivery History</h1>
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">All Equipment</option>
          {equipments.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <SortHeader label="Date" k="fecha" />
              <th className="p-3 pr-2">Time</th>
              <SortHeader label="Location" k="ciudad" />
              <SortHeader label="Equipment" k="placa" />
              <SortHeader label="Litres" k="cantidad" className="text-right" />
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((t) => (
              <tr key={t.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                <td className="p-3 pr-2 whitespace-nowrap">{format(parseISO(t.fecha), "dd/MM/yyyy")}</td>
                <td className="p-3 pr-2 whitespace-nowrap">{format(parseISO(t.fecha), "HH:mm")}</td>
                <td className="p-3 pr-2">{t.ciudad}</td>
                <td className="p-3 pr-2 font-mono text-xs">{t.placa}</td>
                <td className="p-3 text-right font-medium">{(t.cantidad || 0).toLocaleString()} L</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div className="p-3 text-center text-xs text-muted-foreground">Showing 200 of {filtered.length} deliveries</div>
        )}
      </div>
    </div>
  );
}
