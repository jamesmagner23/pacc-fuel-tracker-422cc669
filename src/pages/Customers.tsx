import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, useAllTransactions } from "@/hooks/useTransactions";
import { format, subDays, startOfYear } from "date-fns";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Transactions from "./Transactions";
import ClientPricingTab from "@/components/finance/ClientPricingTab";
import PricingTab from "@/components/finance/PricingTab";

type LocalRange = "global" | "30d" | "90d" | "ytd" | "all" | "custom";

function CustomerList() {
  const { range } = useDateRange();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<"litres" | "deliveries" | "revenue">("litres");
  const [localRange, setLocalRange] = useState<LocalRange>("global");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const navigate = useNavigate();

  // Pull global-range data when localRange === "global", else pull all and filter client-side.
  const useGlobal = localRange === "global";
  const { data: globalTxns = [], isLoading: loadingGlobal } = useTransactions(range);
  const { data: allTxns = [], isLoading: loadingAll } = useAllTransactions();
  const isLoading = useGlobal ? loadingGlobal : loadingAll;

  const filtered = useMemo(() => {
    if (useGlobal) return globalTxns;
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = today;
    switch (localRange) {
      case "30d": start = subDays(today, 30); break;
      case "90d": start = subDays(today, 90); break;
      case "ytd": start = startOfYear(today); break;
      case "all": start = null; end = null; break;
      case "custom":
        start = customStart ?? null;
        end = customEnd ?? null;
        break;
    }
    const startStr = start ? format(start, "yyyy-MM-dd") : null;
    const endStr = end ? format(end, "yyyy-MM-dd") : null;
    return allTxns.filter((t) => {
      if (!t.date) return false;
      if (startStr && t.date < startStr) return false;
      if (endStr && t.date > endStr) return false;
      return true;
    });
  }, [useGlobal, globalTxns, allTxns, localRange, customStart, customEnd]);

  // Responsive page size: 8–10 based on viewport height
  useEffect(() => {
    const compute = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      // tile grid: aim for ~2 rows of tiles
      let perRow = 3;
      if (w >= 1280) perRow = 6;
      else if (w >= 1024) perRow = 5;
      else if (w >= 768) perRow = 4;
      else if (w >= 480) perRow = 3;
      // target ~12 tiles per page, scale up on taller screens
      let target = 12;
      if (h >= 900) target = 18;
      if (h >= 1100) target = 24;
      // round to a multiple of perRow for clean grid
      setPageSize(Math.max(perRow, Math.round(target / perRow) * perRow));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const rows = useMemo(() => {
    const map: Record<string, { name: string; litres: number; deliveries: number; revenue: number }> = {};
    filtered.forEach((t) => {
      const name = t.nombre_cliente1 || "Unknown";
      if (!map[name]) map[name] = { name, litres: 0, deliveries: 0, revenue: 0 };
      map[name].litres += t.cantidad || 0;
      map[name].deliveries += 1;
      map[name].revenue += t.dinero_total || 0;
    });
    return Object.values(map)
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [filtered, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Local date range filter — independent of global toggle */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Range</span>
        {([
          { key: "global", label: "Global" },
          { key: "30d", label: "30d" },
          { key: "90d", label: "90d" },
          { key: "ytd", label: "YTD" },
          { key: "all", label: "All time" },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => { setLocalRange(opt.key); setPage(0); }}
            className={cn(
              "px-2.5 py-1 rounded-md border transition-colors",
              localRange === opt.key
                ? "bg-primary/15 border-primary/40 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-card"
            )}
          >
            {opt.label}
          </button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              onClick={() => setLocalRange("custom")}
              className={cn(
                "px-2.5 py-1 rounded-md border inline-flex items-center gap-1.5 transition-colors",
                localRange === "custom"
                  ? "bg-primary/15 border-primary/40 text-foreground font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-card"
              )}
            >
              <CalendarIcon className="w-3 h-3" />
              {localRange === "custom" && customStart && customEnd
                ? `${format(customStart, "d MMM")} – ${format(customEnd, "d MMM")}`
                : "Custom"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: customStart, to: customEnd }}
              onSelect={(r: any) => {
                setCustomStart(r?.from);
                setCustomEnd(r?.to);
                if (r?.from) setLocalRange("custom");
                setPage(0);
              }}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {!useGlobal && (
          <span className="text-muted-foreground tabular-nums">
            {filtered.length} txns
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Sort by</span>
        {([
          { key: "litres", label: "Litres" },
          { key: "deliveries", label: "Deliveries" },
          { key: "revenue", label: "Revenue" },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              setSortBy(opt.key);
              setPage(0);
            }}
            className={`px-2.5 py-1 rounded-md border transition-colors ${
              sortBy === opt.key
                ? "bg-primary/15 border-primary/40 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-card"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No customers found. Click <strong>Sync Now</strong> to pull data.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {pageRows.map((c, i) => {
              const initials = c.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();
              const litresLabel =
                c.litres >= 1000
                  ? `${(c.litres / 1000).toFixed(1)}kL`
                  : `${Math.round(c.litres)}L`;
              return (
                <button
                  key={c.name}
                  onClick={() => navigate(`/customers/${encodeURIComponent(c.name)}`)}
                  className="rounded-lg border border-border bg-card/40 hover:bg-card hover:border-primary/40 transition-all p-2 flex flex-col text-left animate-fade-in min-h-[88px]"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="w-6 h-6 rounded-md bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {initials || "?"}
                    </div>
                    {c.revenue > 0 && (
                      <div className="text-[9px] text-muted-foreground font-medium tabular-nums leading-tight text-right">
                        ${c.revenue >= 1000 ? `${(c.revenue / 1000).toFixed(1)}k` : Math.round(c.revenue)}
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 flex-1 min-h-0">
                    <div className="text-[11px] font-semibold text-foreground line-clamp-1 leading-tight">
                      {c.name}
                    </div>
                  </div>
                  <div className="mt-1 pt-1 border-t border-border/60 flex items-baseline justify-between gap-1">
                    <span className="text-xs font-bold text-foreground tabular-nums">{litresLabel}</span>
                    <span className="text-[9px] text-muted-foreground tabular-nums">{c.deliveries} drops</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, rows.length)} of {rows.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded-md border border-border hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="tabular-nums">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded-md border border-border hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Customers() {
  return (
    <div className="flex flex-col gap-5 max-w-[1100px] w-full">
      <Tabs defaultValue="customers">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0 overflow-x-auto flex-nowrap w-full no-scrollbar">
          {[
            { value: "customers", label: "Customers" },
            { value: "transactions", label: "Transactions" },
            { value: "pricing", label: "Client Pricing" },
            { value: "quotes", label: "Quote Builder" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-2.5 sm:px-4 py-2.5 sm:py-2 text-[11px] sm:text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent whitespace-nowrap shrink-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="customers" className="mt-5">
          <CustomerList />
        </TabsContent>
        <TabsContent value="transactions" className="mt-5">
          <Transactions embedded />
        </TabsContent>
        <TabsContent value="pricing" className="mt-5">
          <ClientPricingTab />
        </TabsContent>
        <TabsContent value="quotes" className="mt-5">
          <PricingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
