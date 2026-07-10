import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";
import OutreachComposer from "@/components/outreach/OutreachComposer";

export default function WinBackTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [composerTarget, setComposerTarget] = useState<{
    firstName: string; company: string; toEmail: string;
  } | null>(null);

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

  const { data: recentSends = [], refetch: refetchSends } = useQuery({
    queryKey: ["outreach-log-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_log")
        .select("id, to_name, to_email, company, category, segment, sell_price, sent_via, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30000,
  });

  const lapsedCustomers = useMemo(() => {
    if (!allTxns.length) return [];
    const cutoff30 = subDays(new Date(), 30);
    const cutoff60 = subDays(new Date(), 60);
    const cutoff90 = subDays(new Date(), 90);

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
      if (!map[name]) map[name] = { name, lastOrder: orderDate, totalLitres: 0, totalRevenue: 0, orderCount: 0 };
      if (orderDate > map[name].lastOrder) map[name].lastOrder = orderDate;
      map[name].totalLitres += t.cantidad || 0;
      map[name].totalRevenue += t.dinero_total || 0;
      map[name].orderCount += 1;
    });

    return Object.values(map)
      .filter((c) => c.lastOrder < cutoff30)
      .map((c) => {
        let urgency: "warning" | "danger" | "critical";
        if (c.lastOrder < cutoff90) urgency = "critical";
        else if (c.lastOrder < cutoff60) urgency = "danger";
        else urgency = "warning";
        const account = clientAccounts.find((a) =>
          a.company_name === c.name || (a.speedsol_names && a.speedsol_names.includes(c.name))
        );
        const daysSince = Math.floor((Date.now() - c.lastOrder.getTime()) / 86400000);
        return { ...c, urgency, daysSince, account };
      })
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.totalLitres - a.totalLitres);
  }, [allTxns, clientAccounts, search]);

  const urgencyColors = {
    warning: { bg: "var(--warning-bg)", text: "var(--warning)", label: "30–60 days" },
    danger: { bg: "var(--negative-bg)", text: "var(--negative)", label: "60–90 days" },
    critical: { bg: "var(--negative-bg)", text: "var(--negative)", label: "90+ days" },
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

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "30–60 days", count: lapsedCustomers.filter((c) => c.urgency === "warning").length, color: "var(--warning)" },
          { label: "60–90 days", count: lapsedCustomers.filter((c) => c.urgency === "danger").length, color: "var(--negative)" },
          { label: "90+ days", count: lapsedCustomers.filter((c) => c.urgency === "critical").length, color: "var(--negative)" },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-lg text-center glass-card">
            <div className="text-lg sm:text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {lapsedCustomers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">All customers have ordered within the last 30 days 🎉</div>
      ) : (
        <div className="space-y-2">
          {lapsedCustomers.map((c, i) => {
            const uc = urgencyColors[c.urgency];
            return (
              <div key={c.name} className="w-full glass-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => navigate(`/customers/${encodeURIComponent(c.name)}`)} className="font-semibold text-xs sm:text-sm truncate text-foreground hover:text-primary transition-colors text-left">
                      {c.name}
                    </button>
                    <span className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0" style={{ background: uc.bg, color: uc.text }}>
                      {c.daysSince}d ago
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-muted-foreground">
                    <span>Last: {format(c.lastOrder, "dd MMM yyyy")}</span>
                    <span>{c.orderCount} orders</span>
                    <span>{c.totalLitres.toLocaleString()}L total</span>
                    {c.totalRevenue > 0
                      ? <span>${c.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} rev</span>
                      : <span className="italic opacity-70">no rate on file</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.account?.contact_phone && (
                    <a href={`tel:${c.account.contact_phone}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium border border-border hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground">
                      <Phone className="w-3 h-3" /> <span className="hidden sm:inline">Call</span>
                    </a>
                  )}
                  {c.account?.contact_email && !c.account.contact_email.includes("@pending.com") && (
                    <button
                      type="button"
                      onClick={() => setComposerTarget({
                        firstName: (c.account?.contact_name || "").split(" ")[0] || "",
                        company: c.account?.company_name || c.name,
                        toEmail: c.account!.contact_email!,
                      })}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium border border-border hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground bg-transparent cursor-pointer"
                    >
                      <Mail className="w-3 h-3" /> <span className="hidden sm:inline">Email</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recentSends.length > 0 && (
        <div className="mt-6 bg-card border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Recent outreach (last 20)</div>
          <div className="space-y-1.5">
            {recentSends.map((s: any) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="text-foreground font-medium">{s.to_name || s.to_email || "—"}</span>
                {s.company && <span>· {s.company}</span>}
                {s.category && <span>· {s.category}</span>}
                {s.sell_price && <span>· {s.sell_price}</span>}
                <span>· {s.sent_via}</span>
                <span className="ml-auto">{format(new Date(s.created_at), "dd MMM, h:mma")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <OutreachComposer
        open={composerTarget !== null}
        onClose={() => { setComposerTarget(null); refetchSends(); }}
        defaultCategory="winback"
        sellPricePerLitre={null}
        firstName={composerTarget?.firstName}
        company={composerTarget?.company}
        toEmail={composerTarget?.toEmail}
      />
    </div>
  );
}