import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions } from "@/hooks/useTransactions";
import Transactions from "./Transactions";
import ClientPricingTab from "@/components/finance/ClientPricingTab";
import PricingTab from "@/components/finance/PricingTab";

function CustomerList() {
  const { range } = useDateRange();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { data: filtered = [], isLoading } = useTransactions(range);

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No customers found. Click <strong>Sync Now</strong> to pull data.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((c, i) => (
            <button
              key={c.name}
              onClick={() => navigate(`/customers/${encodeURIComponent(c.name)}`)}
              className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors text-left animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div>
                <div className="font-semibold text-sm">{c.name}</div>
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
      )}
    </div>
  );
}

export default function Customers() {
  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
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
              className="px-2.5 sm:px-4 py-2 text-[12px] sm:text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent whitespace-nowrap shrink-0"
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
