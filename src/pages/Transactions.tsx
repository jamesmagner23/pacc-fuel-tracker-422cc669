import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Download, ArrowUpDown, FileText, CheckSquare, Square, Send } from "lucide-react";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions } from "@/hooks/useTransactions";
import { format, parseISO } from "date-fns";

type SortKey = "fecha" | "nombre_cliente1" | "ciudad" | "cantidad" | "ppu" | "dinero_total" | "factura";

export default function Transactions({ embedded }: { embedded?: boolean } = {}) {
  const { range } = useDateRange();
  const { data: txns = [], isLoading } = useTransactions(range);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [truckFilter, setTruckFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const customers = useMemo(() => [...new Set(txns.map((t) => t.nombre_cliente1).filter(Boolean))].sort() as string[], [txns]);
  const trucks = useMemo(() => [...new Set(txns.map((t) => t.estacion).filter(Boolean))].sort() as string[], [txns]);
  const drivers = useMemo(() => [...new Set(txns.map((t) => t.nombre_vendedor).filter(Boolean))].sort() as string[], [txns]);
  const locations = useMemo(() => [...new Set(txns.map((t) => t.ciudad).filter(Boolean))].sort() as string[], [txns]);

  const filtered = useMemo(() => {
    let result = [...txns];
    if (customerFilter) result = result.filter((t) => t.nombre_cliente1 === customerFilter);
    if (truckFilter) result = result.filter((t) => t.estacion === truckFilter);
    if (driverFilter) result = result.filter((t) => t.nombre_vendedor === driverFilter);
    if (locationFilter) result = result.filter((t) => t.ciudad === locationFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        (t.nombre_cliente1 || "").toLowerCase().includes(q) ||
        (t.ciudad || "").toLowerCase().includes(q) ||
        (t.nombre_vendedor || "").toLowerCase().includes(q) ||
        (t.factura?.toString() || "").includes(q)
      );
    }
    result.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av || "").localeCompare(String(bv || "")) : String(bv || "").localeCompare(String(av || ""));
    });
    return result;
  }, [txns, search, customerFilter, truckFilter, driverFilter, locationFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const visibleIds = filtered.slice(0, 100).map((t) => t.id);
    setSelected(new Set(visibleIds));
  };

  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const openCombinedDocket = () => {
    const ids = Array.from(selected).join(",");
    navigate(`/docket/multi?ids=${ids}`);
  };

  const selectedLitres = useMemo(() => {
    return txns.filter((t) => selected.has(t.id)).reduce((sum, t) => sum + (t.cantidad || 0), 0);
  }, [txns, selected]);

  const exportCSV = () => {
    const headers = "Date,Customer,Location,Truck,Driver,Litres,$/L,Total,Invoice";
    const rows = filtered.map((t) =>
      `${format(parseISO(t.fecha), "yyyy-MM-dd HH:mm")},"${t.nombre_cliente1}","${t.ciudad}","${t.estacion}",${t.nombre_vendedor},${t.cantidad},${t.ppu},${t.dinero_total},${t.factura}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pacc-fuel-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg sm:text-xl font-bold">Transactions</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setSelectMode(!selectMode); if (selectMode) clearSelection(); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectMode ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> {selectMode ? "Cancel" : "Select"}
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">All Customers</option>
          {customers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={truckFilter} onChange={(e) => setTruckFilter(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">All Trucks</option>
          {trucks.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">All Drivers</option>
          {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              {selectMode && (
                <th className="p-3 pr-1 w-10">
                  <button onClick={selected.size > 0 ? clearSelection : selectAllVisible} className="text-muted-foreground hover:text-foreground transition-colors">
                    {selected.size > 0 ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
              )}
              <SortHeader label="Date" k="fecha" />
              <SortHeader label="Customer" k="nombre_cliente1" />
              <th className="p-3 pr-2 hidden lg:table-cell">Location</th>
              <th className="p-3 pr-2 hidden md:table-cell">Truck</th>
              <th className="p-3 pr-2 hidden lg:table-cell">Driver</th>
              <SortHeader label="Litres" k="cantidad" className="text-right" />
              <SortHeader label="$/L" k="ppu" className="text-right hidden sm:table-cell" />
              <SortHeader label="Total" k="dinero_total" className="text-right" />
              <th className="p-3 pr-2 text-right hidden md:table-cell">Invoice</th>
              <th className="p-3 pr-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((t) => {
              const isSelected = selected.has(t.id);
              return (
                <tr
                  key={t.id}
                  className={`border-b border-border/30 transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-secondary/30"} ${selectMode ? "cursor-pointer" : ""}`}
                  onClick={selectMode ? () => toggleSelect(t.id) : undefined}
                >
                  {selectMode && (
                    <td className="p-3 pr-1">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                    </td>
                  )}
                  <td className="p-3 pr-2 whitespace-nowrap">{format(parseISO(t.fecha), "dd MMM HH:mm")}</td>
                  <td className="p-3 pr-2 truncate max-w-[140px]">{t.nombre_cliente1}</td>
                  <td className="p-3 pr-2 hidden lg:table-cell">{t.ciudad}</td>
                  <td className="p-3 pr-2 whitespace-nowrap hidden md:table-cell">{t.estacion}</td>
                  <td className="p-3 pr-2 hidden lg:table-cell">{t.nombre_vendedor}</td>
                  <td className="p-3 pr-2 text-right font-medium">{(t.cantidad || 0).toLocaleString()}</td>
                  <td className="p-3 pr-2 text-right hidden sm:table-cell">${(t.ppu || 0).toFixed(2)}</td>
                  <td className="p-3 text-right font-medium">${(t.dinero_total || 0).toLocaleString()}</td>
                  <td className="p-3 pr-2 text-right hidden md:table-cell font-mono text-xs">{t.factura}</td>
                  <td className="p-3 pr-2 text-center">
                    <Link to={`/docket/${t.id}`} className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="View Docket" onClick={(e) => e.stopPropagation()}>
                      <FileText className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div className="p-3 text-center text-xs text-muted-foreground">Showing 100 of {filtered.length} transactions</div>
        )}
      </div>

      {/* Floating action bar when items are selected */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-2xl px-3 sm:px-5 py-3 flex flex-wrap items-center gap-2 sm:gap-4 animate-in slide-in-from-bottom-4 max-w-[95vw]">
          <div className="text-sm">
            <span className="font-bold text-foreground">{selected.size}</span>
            <span className="text-muted-foreground ml-1">selected</span>
            <span className="text-muted-foreground mx-2">·</span>
            <span className="font-semibold text-foreground">{selectedLitres.toLocaleString(undefined, { maximumFractionDigits: 0 })} L</span>
          </div>
          <div className="w-px h-6 bg-border" />
          <button
            onClick={openCombinedDocket}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> View Docket
          </button>
          <button
            onClick={openCombinedDocket}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> Send to Client
          </button>
          <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
