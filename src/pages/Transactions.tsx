import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { useDateRange } from "@/hooks/useDateRange";
import { transactions, customers, allProjects, trucks, filterByDateRange } from "@/data/mockData";
import { format, parseISO } from "date-fns";

export default function Transactions() {
  const { range } = useDateRange();
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [truckFilter, setTruckFilter] = useState("");

  const filtered = useMemo(() => {
    let txns = filterByDateRange(transactions, range);
    if (customerFilter) txns = txns.filter((t) => t.customerId === customerFilter);
    if (truckFilter) txns = txns.filter((t) => t.truckId === truckFilter);
    if (search) {
      const q = search.toLowerCase();
      txns = txns.filter(
        (t) =>
          t.customerName.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q) ||
          t.driver.toLowerCase().includes(q)
      );
    }
    return txns;
  }, [range, search, customerFilter, truckFilter]);

  const exportCSV = () => {
    const headers = "Date,Time,Customer,Project,Truck,Driver,Litres,$/L,Total";
    const rows = filtered.map(
      (t) => `${t.date},${t.time},"${t.customerName}","${t.projectName}","${t.truckName}",${t.driver},${t.litres},${t.pricePerLitre},${t.total}`
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

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Transactions</h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={truckFilter}
          onChange={(e) => setTruckFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Trucks</option>
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>{t.name} — {t.model}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="p-3 pr-2">Date</th>
              <th className="p-3 pr-2">Time</th>
              <th className="p-3 pr-2">Customer</th>
              <th className="p-3 pr-2 hidden lg:table-cell">Project</th>
              <th className="p-3 pr-2 hidden md:table-cell">Truck</th>
              <th className="p-3 pr-2 hidden lg:table-cell">Driver</th>
              <th className="p-3 pr-2 text-right">Litres</th>
              <th className="p-3 pr-2 text-right hidden sm:table-cell">$/L</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((t) => (
              <tr key={t.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                <td className="p-3 pr-2 whitespace-nowrap">{format(parseISO(t.date), "dd MMM")}</td>
                <td className="p-3 pr-2">{t.time}</td>
                <td className="p-3 pr-2 truncate max-w-[140px]">{t.customerName}</td>
                <td className="p-3 pr-2 truncate max-w-[180px] hidden lg:table-cell">{t.projectName}</td>
                <td className="p-3 pr-2 whitespace-nowrap hidden md:table-cell">{t.truckName}</td>
                <td className="p-3 pr-2 hidden lg:table-cell">{t.driver}</td>
                <td className="p-3 pr-2 text-right font-medium">{t.litres.toLocaleString()}</td>
                <td className="p-3 pr-2 text-right hidden sm:table-cell">${t.pricePerLitre.toFixed(2)}</td>
                <td className="p-3 text-right font-medium">${t.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div className="p-3 text-center text-xs text-muted-foreground">
            Showing 100 of {filtered.length} transactions
          </div>
        )}
      </div>
    </div>
  );
}
