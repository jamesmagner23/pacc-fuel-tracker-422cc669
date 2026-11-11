import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Download, ArrowUpDown, FileText, CheckSquare, Square, Send } from "lucide-react";
import { useTransactionPage, fetchTransactionPage } from "@/hooks/useTransactionPage";
import { transactionDateRange, melbourneDate, type TransactionPreset } from "@/lib/transactionDates";
import { useTransactionPricing } from "@/hooks/useTransactionPricing";
import { TransactionPrice } from "@/components/TransactionPrice";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/requestTimeout";
import type { Transaction } from "@/hooks/useTransactions";

import { useDemo } from "@/hooks/useDemo";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

type SortKey = "fecha" | "nombre_cliente1" | "cantidad" | "factura";

export default function Transactions({ embedded }: { embedded?: boolean } = {}) {
  const [preset, setPreset] = useState<TransactionPreset>("30d");
  const [from, setFrom] = useState(melbourneDate());
  const [to, setTo] = useState(melbourneDate());
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isDemo = useDemo();
  const demoSuffix = isDemo ? `?${params.toString()}` : "";
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [truckFilter, setTruckFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const dates = transactionDateRange(preset, from, to);
  const filters = useMemo(() => ({ ...dates, search, customer: customerFilter, truck: truckFilter, driver: driverFilter, sort: sortKey, ascending: sortAsc }), [dates.start, dates.end, search, customerFilter, truckFilter, driverFilter, sortKey, sortAsc]);
  const result = useTransactionPage(filters, page);
  const txns = result.data?.rows ?? [];
  const filtered = txns;
  const isLoading = result.isLoading;
  const total = result.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  const pricing = useTransactionPricing(txns);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [filters]);
  useEffect(() => { if (result.data && page >= totalPages) setPage(totalPages - 1); }, [totalPages, page, result.data]);
  const customers = useMemo(() => [...new Set(txns.map(t => t.nombre_cliente1).filter(Boolean))].sort() as string[], [txns]);
  const trucks = useMemo(() => [...new Set(txns.map(t => t.estacion).filter(Boolean))].sort() as string[], [txns]);
  const drivers = useMemo(() => [...new Set(txns.map(t => t.nombre_vendedor).filter(Boolean))].sort() as string[], [txns]);

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
    const visibleIds = filtered.map((t) => t.id);
    setSelected(new Set(visibleIds));
  };

  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const openCombinedDocket = () => {
    const ids = Array.from(selected).join(",");
    const extra = isDemo ? `&${params.toString()}` : "";
    navigate(`/docket/multi?ids=${ids}${extra}`);
  };

  const selectedLitres = useMemo(() => {
    return txns.filter((t) => selected.has(t.id)).reduce((sum, t) => sum + (t.cantidad || 0), 0);
  }, [txns, selected]);

  const exportCSV = async () => {
    setExporting(true);
    try {
      const all: Transaction[] = [];
      if (isDemo) all.push(...filtered);
      else for (let i = 0; ; i++) {
        const batch = await fetchTransactionPage(filters, i);
        all.push(...batch.rows);
        if (all.length >= batch.count || !batch.rows.length) break;
      }
      const prices: Record<number, import("@/lib/transactionPricing").PricingResult> = {};
      for (let i = 0; i < all.length; i += 500) {
        if (isDemo) { all.slice(i, i + 500).forEach(t => { prices[t.id] = pricing.getTxPricing(t); }); continue; }
        const { data, error } = await withTimeout(supabase.functions.invoke("transaction-sell-pricing", { body: { ids: all.slice(i, i + 500).map(t => t.id) } }), 30_000);
        if (error || data?.error) throw error ?? new Error(data.error);
        Object.assign(prices, data?.prices ?? {});
      }
      const rows = all.map(t => { const p = prices[t.id]; return [format(parseISO(t.fecha), "yyyy-MM-dd HH:mm"), t.nombre_cliente1 ?? "", t.estacion ?? "", t.nombre_vendedor ?? "", t.cantidad ?? "", p?.sellPPL ?? "Rate missing", p?.total ?? "Rate missing", p?.source ?? "missing", t.factura ?? ""]; });
      const csv = [["Date", "Customer", "Truck", "Driver", "Litres", "$/L inc GST", "Total inc GST", "Price source", "Invoice"], ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `pacc-fuel-transactions-${dates.start}-${dates.end}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Export failed. Please retry."); }
    finally { setExporting(false); }
  };

  const SortHeader = ({ label, k, className = "" }: { label: string; k: SortKey; className?: string }) => (
    <th className={`p-3 pr-2 cursor-pointer hover:text-foreground transition-colors ${className}`} onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="w-3 h-3" /></span>
    </th>
  );



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
          <button disabled={exporting || pricing.isLoading || Boolean(pricing.error)} onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <Download className="w-3.5 h-3.5" /> {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="Transaction date range" className="bg-card border border-border rounded-md p-2 text-sm" value={preset} onChange={e => setPreset(e.target.value as TransactionPreset)}>
          <option value="today">Today</option><option value="week">This week</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="last-month">Last month</option><option value="custom">Custom</option>
        </select>
        {preset === "custom" && <><input aria-label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-card border border-border rounded-md p-2" /><input aria-label="To date" type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-card border border-border rounded-md p-2" /></>}
        <span className="text-xs text-muted-foreground">{dates.start} to {dates.end}</span>
      </div>
      {dates.start > dates.end && <p className="text-warning">From date must be before the to date.</p>}
      {result.error && <div className="text-warning">Transactions could not be loaded. <Button variant="outline" size="sm" onClick={() => result.refetch()}>Retry</Button></div>}
      {pricing.error && <div className="text-warning">Pricing unavailable. <Button variant="outline" size="sm" onClick={() => pricing.refetch()}>Retry</Button></div>}
      {isLoading && <p className="text-muted-foreground">Loading transactions...</p>}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search customers..." aria-label="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
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

              <th className="p-3 pr-2 hidden md:table-cell">Truck</th>
              <th className="p-3 pr-2 hidden lg:table-cell">Driver</th>
              <SortHeader label="Litres" k="cantidad" className="text-right" />
              <th className="p-3 text-right hidden sm:table-cell">$/L inc GST</th>
              <th className="p-3 text-right">Total inc GST</th>
              <th className="p-3 pr-2 text-right hidden md:table-cell">Invoice</th>
              <th className="p-3 pr-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
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

                  <td className="p-3 pr-2 whitespace-nowrap hidden md:table-cell">{t.estacion}</td>
                  <td className="p-3 pr-2 hidden lg:table-cell">{t.nombre_vendedor}</td>
                  <td className="p-3 pr-2 text-right font-medium">{(t.cantidad || 0).toLocaleString()}</td>
                  <td className="p-3 pr-2 text-right hidden sm:table-cell"><TransactionPrice pricing={pricing.getTxPricing(t)} /></td>
                  <td className="p-3 text-right font-medium"><TransactionPrice pricing={pricing.getTxPricing(t)} total /></td>
                  <td className="p-3 pr-2 text-right hidden md:table-cell font-mono text-xs">{t.factura}</td>
                  <td className="p-3 pr-2 text-center">
                    <Link to={`/docket/${t.id}${demoSuffix}`} className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="View Docket" onClick={(e) => e.stopPropagation()}>
                      <FileText className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && !result.error && filtered.length === 0 && <p className="p-6 text-center text-muted-foreground">No transactions for these filters.</p>}
      </div>
      <div className="flex flex-wrap gap-3 items-center justify-between text-sm">
        <span>{total.toLocaleString()} transactions, page {page + 1} of {totalPages}</span>
        <div className="flex gap-2"><Button variant="outline" size="sm" aria-label="Previous page" disabled={page === 0 || isLoading} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" size="sm" aria-label="Next page" disabled={page + 1 >= totalPages || isLoading} onClick={() => setPage(p => p + 1)}>Next</Button></div>
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
