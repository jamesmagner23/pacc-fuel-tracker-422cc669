import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, AlertTriangle, Phone, Mail } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions } from "@/hooks/useTransactions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";
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
              className="w-full glass-card p-3 sm:p-4 flex items-center justify-between hover:border-primary/30 transition-colors text-left animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="min-w-0 flex-1 mr-3">
                <div className="font-semibold text-xs sm:text-sm truncate">{c.name}</div>
              </div>
              <div className="flex gap-3 sm:gap-6 text-right shrink-0">
                <div>
                  <div className="text-xs sm:text-sm font-bold">{c.litres.toLocaleString()}L</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground">Volume</div>
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-bold">{c.deliveries}</div>
                  <div className="text-[10px] text-muted-foreground">Deliveries</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold">${c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground">Revenue</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LapsedCustomers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Get ALL transactions (no date filter) to find lapsed ones
  const { data: allTxns = [], isLoading: loadingAll } = useQuery({
    queryKey: ["all-transactions-lapsed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("nombre_cliente1, fecha, cantidad, dinero_total")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300000,
  });

  // Get client accounts for contact info
  const { data: clientAccounts = [] } = useQuery({
    queryKey: ["client-accounts-lapsed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("company_name, contact_email, contact_phone, contact_name, speedsol_names");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300000,
  });

  const lapsedCustomers = useMemo(() => {
    if (!allTxns.length) return [];

    const cutoff30 = subDays(new Date(), 30);
    const cutoff60 = subDays(new Date(), 60);
    const cutoff90 = subDays(new Date(), 90);

    // Group by customer: find last order date, total historical volume
    const map: Record<string, {
      name: string;
      lastOrder: Date;
      totalLitres: number;
      totalRevenue: number;
      orderCount: number;
    }> = {};

    allTxns.forEach((t) => {
      const name = t.nombre_cliente1 || "Unknown";
      if (name === "Unknown") return;
      const orderDate = new Date(t.fecha);

      if (!map[name]) {
        map[name] = { name, lastOrder: orderDate, totalLitres: 0, totalRevenue: 0, orderCount: 0 };
      }
      if (orderDate > map[name].lastOrder) map[name].lastOrder = orderDate;
      map[name].totalLitres += t.cantidad || 0;
      map[name].totalRevenue += t.dinero_total || 0;
      map[name].orderCount += 1;
    });

    // Only include customers whose last order was > 30 days ago
    return Object.values(map)
      .filter((c) => c.lastOrder < cutoff30)
      .map((c) => {
        let urgency: "warning" | "danger" | "critical";
        if (c.lastOrder < cutoff90) urgency = "critical";
        else if (c.lastOrder < cutoff60) urgency = "danger";
        else urgency = "warning";

        // Find matching client account for contact info
        const account = clientAccounts.find((a) =>
          a.company_name === c.name ||
          (a.speedsol_names && a.speedsol_names.includes(c.name))
        );

        const daysSince = Math.floor((Date.now() - c.lastOrder.getTime()) / (1000 * 60 * 60 * 24));

        return { ...c, urgency, daysSince, account };
      })
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.totalLitres - a.totalLitres);
  }, [allTxns, clientAccounts, search]);

  const urgencyColors = {
    warning: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B", label: "30–60 days" },
    danger: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", label: "60–90 days" },
    critical: { bg: "rgba(220,38,38,0.2)", text: "#DC2626", label: "90+ days" },
  };

  if (loadingAll) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search lapsed customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          {lapsedCustomers.length} inactive customer{lapsedCustomers.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "30–60 days", count: lapsedCustomers.filter((c) => c.urgency === "warning").length, color: "#F59E0B" },
          { label: "60–90 days", count: lapsedCustomers.filter((c) => c.urgency === "danger").length, color: "#EF4444" },
          { label: "90+ days", count: lapsedCustomers.filter((c) => c.urgency === "critical").length, color: "#DC2626" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-3 rounded-lg text-center glass-card"
          >
            <div className="text-lg sm:text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {lapsedCustomers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          All customers have ordered within the last 30 days 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {lapsedCustomers.map((c, i) => {
            const uc = urgencyColors[c.urgency];
            return (
              <div
                key={c.name}
                className="w-full glass-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 animate-fade-in"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Customer info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => navigate(`/customers/${encodeURIComponent(c.name)}`)}
                      className="font-semibold text-xs sm:text-sm truncate text-foreground hover:text-primary transition-colors text-left"
                    >
                      {c.name}
                    </button>
                    <span
                      className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                      style={{ background: uc.bg, color: uc.text }}
                    >
                      {c.daysSince}d ago
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-muted-foreground">
                    <span>Last: {format(c.lastOrder, "dd MMM yyyy")}</span>
                    <span>{c.orderCount} orders</span>
                    <span>{c.totalLitres.toLocaleString()}L total</span>
                    <span>${c.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} rev</span>
                  </div>
                </div>

                {/* Contact actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {c.account?.contact_phone && (
                    <a
                      href={`tel:${c.account.contact_phone}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium border border-border hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3 h-3" />
                      <span className="hidden sm:inline">Call</span>
                    </a>
                  )}
                  {c.account?.contact_email && !c.account.contact_email.includes("@pending.com") && (
                    <a
                      href={`mailto:${c.account.contact_email}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium border border-border hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="w-3 h-3" />
                      <span className="hidden sm:inline">Email</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
            { value: "lapsed", label: "Win Back" },
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
        <TabsContent value="lapsed" className="mt-5">
          <LapsedCustomers />
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
