import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions } from "@/hooks/useTransactions";
import Transactions from "./Transactions";
import ClientPricingTab from "@/components/finance/ClientPricingTab";
import PricingTab from "@/components/finance/PricingTab";

function CustomerList() {
  const { range } = useDateRange();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();
  const { data: filtered = [], isLoading } = useTransactions(range);

  // Responsive page size: 8–10 based on viewport height
  useEffect(() => {
    const compute = () => {
      const h = window.innerHeight;
      if (h < 700) setPageSize(8);
      else if (h < 850) setPageSize(9);
      else setPageSize(10);
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
      .sort((a, b) => b.litres - a.litres);
  }, [filtered, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
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

      {rows.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No customers found. Click <strong>Sync Now</strong> to pull data.</div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="hidden sm:grid grid-cols-[40px_1fr_100px_90px_110px] gap-3 px-4 py-2 bg-card/50 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <div>#</div>
              <div>Customer</div>
              <div className="text-right">Volume</div>
              <div className="text-right">Deliveries</div>
              <div className="text-right">Revenue</div>
            </div>
            {pageRows.map((c, i) => {
              const rank = currentPage * pageSize + i + 1;
              return (
                <button
                  key={c.name}
                  onClick={() => navigate(`/customers/${encodeURIComponent(c.name)}`)}
                  className="w-full grid grid-cols-[32px_1fr_auto] sm:grid-cols-[40px_1fr_100px_90px_110px] gap-3 px-3 sm:px-4 py-2.5 items-center text-left bg-card/30 hover:bg-card transition-colors border-b border-border last:border-b-0 animate-fade-in"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <div className="text-[11px] text-muted-foreground font-mono">{rank}</div>
                  <div className="min-w-0">
                    <div className="font-medium text-xs sm:text-sm truncate text-foreground">{c.name}</div>
                    <div className="sm:hidden text-[10px] text-muted-foreground mt-0.5">
                      {c.litres.toLocaleString()}L · {c.deliveries} deliveries
                    </div>
                  </div>
                  <div className="hidden sm:block text-right text-xs font-semibold tabular-nums">{c.litres.toLocaleString()}L</div>
                  <div className="hidden sm:block text-right text-xs text-muted-foreground tabular-nums">{c.deliveries}</div>
                  <div className="text-right text-xs sm:text-sm font-semibold tabular-nums">
                    ${c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
