import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { TruckMap } from "@/components/TruckMap";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays } from "date-fns";
import { Download, MapPin, Calendar, Droplets, FileText, LogOut } from "lucide-react";
import { PACCLogo } from "@/components/PACCLogo";
import { logActivity } from "@/hooks/useActivityLog";
import { useDemo } from "@/hooks/useDemo";
import { getDemoData, DEMO_CLIENT_ACCOUNTS, DEMO_SCHEDULED_DELIVERIES } from "@/data/demoData";

const tabs = ["Overview", "Deliveries", "Sites", "Scheduled"] as const;
type Tab = (typeof tabs)[number];

// ── Fetch customer's own transactions (filtered by speedsol_names) ──
function useCustomerTransactions(range: "week" | "month" | "all", speedsolNames: string[]) {
  const isDemo = useDemo();
  const start =
    range === "all"
      ? null
      : format(subDays(new Date(), range === "week" ? 7 : 30), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["customer-transactions", range, speedsolNames, isDemo],
    queryFn: async () => {
      if (isDemo) {
        const txns = getDemoData().transactions.filter(
          (t) => speedsolNames.includes(t.nombre_cliente1 || "")
        );
        if (start) return txns.filter((t) => (t.date || "") >= start);
        return txns;
      }
      if (speedsolNames.length === 0) return [];
      let q = supabase
        .from("transactions")
        .select("*")
        .in("nombre_cliente1", speedsolNames)
        .order("fecha", { ascending: false });
      if (start) q = q.gte("date", start);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: speedsolNames.length > 0,
  });
}

// ── Fetch scheduled deliveries ──
function useScheduledDeliveries(clientAccountId: number | null) {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["scheduled-deliveries", clientAccountId, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return DEMO_SCHEDULED_DELIVERIES.filter(
          (d) => d.client_account_id === clientAccountId
        );
      }
      const { data, error } = await supabase
        .from("scheduled_deliveries")
        .select("*")
        .eq("client_account_id", clientAccountId!)
        .gte("scheduled_date", format(new Date(), "yyyy-MM-dd"))
        .order("scheduled_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientAccountId,
  });
}

// ── Fetch current user profile ──
function useCustomerProfile() {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["customer-profile", isDemo],
    queryFn: async () => {
      if (isDemo) {
        const account = DEMO_CLIENT_ACCOUNTS[0];
        return {
          user_id: "u3",
          role: "client",
          client_account_id: account.id,
          companyName: account.company_name,
          speedsolNames: account.speedsol_names,
        };
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;

      // Fetch linked client account
      let companyName = "Your Account";
      let speedsolNames: string[] = [];
      if (data?.client_account_id) {
        const { data: ca } = await supabase
          .from("client_accounts")
          .select("company_name, speedsol_names")
          .eq("id", data.client_account_id)
          .single();
        if (ca) {
          companyName = ca.company_name;
          speedsolNames = ca.speedsol_names || [];
        }
      }

      return { ...data, companyName, speedsolNames };
    },
  });
}

// ── CSV Export ──
function exportCSV(transactions: any[], filename: string) {
  const headers = ["Date", "Time", "Site", "Litres", "Invoice"];
  const rows = transactions.map((t) => [
    t.date || "",
    t.fecha ? format(new Date(t.fecha), "HH:mm") : "",
    t.nombre_cliente1 || "",
    t.cantidad?.toFixed(2) || "0",
    t.factura || "",
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  logActivity("export", { type: "csv", filename, rows: transactions.length });
}

// ── Open branded docket page for single delivery ──
function openDocket(tx: any, demoSuffix = "") {
  window.open(`/docket/${tx.id}${demoSuffix}`, "_blank");
  logActivity("export", { type: "docket", invoice: tx.factura || tx.id });
}

const card: React.CSSProperties = {
  background: "var(--surface, #4A3525)",
  border: "1px solid var(--surface-border, #6B5240)",
  borderRadius: 10,
  padding: "18px 20px",
};

export default function CustomerPortal() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [range, setRange] = useState<"week" | "month" | "all">("month");
  const [siteFilter, setSiteFilter] = useState("all");
  const isDemo = useDemo();
  const [params] = useSearchParams();
  const demoSuffix = isDemo ? `?${params.toString()}` : "";

  const { data: profile } = useCustomerProfile();
  const speedsolNames = profile?.speedsolNames || [];
  const { data: transactions = [], isLoading } = useCustomerTransactions(range, speedsolNames);
  const clientAccountId = profile?.client_account_id || null;
  const { data: scheduled = [] } = useScheduledDeliveries(clientAccountId);

  const companyName = profile?.companyName || "Your Account";

  useEffect(() => {
    logActivity("page_view", { page: "customer_portal" });
  }, []);

  // All unique sites for this customer
  const sites = useMemo(() => {
    const s = new Set(
      transactions.map((t: any) => t.nombre_cliente1).filter(Boolean)
    );
    return Array.from(s) as string[];
  }, [transactions]);

  const filtered = useMemo(() => {
    if (siteFilter === "all") return transactions;
    return transactions.filter((t: any) => t.nombre_cliente1 === siteFilter);
  }, [transactions, siteFilter]);

  const totalLitres = filtered.reduce(
    (s: number, t: any) => s + (t.cantidad || 0),
    0
  );
  const totalDeliveries = filtered.length;

  // Site breakdown
  const siteBreakdown = useMemo(() => {
    const map: Record<string, { litres: number; count: number; lastDate: string }> = {};
    transactions.forEach((t: any) => {
      const site = t.nombre_cliente1 || "Unknown";
      if (!map[site]) map[site] = { litres: 0, count: 0, lastDate: "" };
      map[site].litres += t.cantidad || 0;
      map[site].count += 1;
      if (!map[site].lastDate || (t.date && t.date > map[site].lastDate)) {
        map[site].lastDate = t.date || "";
      }
    });
    return Object.entries(map)
      .map(([site, d]) => ({ site, ...d }))
      .sort((a, b) => b.litres - a.litres);
  }, [transactions]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div style={{ minHeight: isDemo ? undefined : "100vh", background: "var(--background, #3D2B1A)", color: "var(--text-primary, #F5E6D0)" }}>
      {/* Header — hidden in demo mode since Layout provides navigation */}
      {!isDemo && (
      <div
        style={{
          borderBottom: "1px solid var(--surface-border, #6B5240)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <PACCLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary, #D4C4A8)" }}>{companyName}</span>
          <button
            onClick={handleSignOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              color: "var(--text-secondary, #C4A882)",
              fontSize: 12,
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: 8,
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* Page title + range toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{companyName}</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary, #C4A882)", margin: "4px 0 0" }}>
              Fuel delivery portal
            </p>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["week", "month", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 16,
                  fontSize: 11,
                  fontWeight: range === r ? 500 : 400,
                  color: range === r ? "var(--text-primary, #F5E6D0)" : "var(--text-muted, #444444)",
                  background: range === r ? "var(--accent, #E8461E)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {r === "week" ? "7 days" : r === "month" ? "30 days" : "All time"}
              </button>
            ))}
          </div>
        </div>

        {/* Tab strip */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid #6B5240",
            marginBottom: 20,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: activeTab === tab ? 500 : 400,
                color: activeTab === tab ? "var(--text-primary, #F5E6D0)" : "var(--text-muted, #444444)",
                background: "transparent",
                border: "none",
                borderBottom:
                  activeTab === tab
                    ? "2px solid #E8461E"
                    : "2px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              {[
                { label: "Total Litres", value: totalLitres.toLocaleString() + "L", icon: <Droplets className="w-4 h-4" /> },
                { label: "Deliveries", value: totalDeliveries.toString(), icon: <Calendar className="w-4 h-4" /> },
                { label: "Sites", value: sites.length.toString(), icon: <MapPin className="w-4 h-4" /> },
                {
                  label: "Avg Per Delivery",
                  value: totalDeliveries > 0 ? Math.round(totalLitres / totalDeliveries) + "L" : "—",
                  icon: <Droplets className="w-4 h-4" />,
                },
              ].map((k) => (
                <div key={k.label} style={card}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "var(--text-secondary, #C4A882)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {k.label}
                    </span>
                    <span style={{ color: "var(--text-secondary, #C4A882)" }}>{k.icon}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{k.value}</div>
                </div>
              ))}
            </div>

            <TruckMap height={220} compact={false} />

            <div style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>Recent Deliveries</span>
                <button
                  onClick={() => setActiveTab("Deliveries")}
                  style={{
                    fontSize: 11,
                    color: "var(--accent, #E8461E)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  View all →
                </button>
              </div>
              {transactions.slice(0, 5).map((t: any, i: number) => (
                <div
                  key={t.id || i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: i > 0 ? "1px solid #6B5240" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.nombre_cliente1}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary, #C4A882)" }}>
                      {t.date ? format(parseISO(t.date), "dd MMM yyyy") : "—"}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {(t.cantidad || 0).toLocaleString()}L
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DELIVERIES TAB ── */}
        {activeTab === "Deliveries" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Filters + export */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                style={{
                  background: "var(--surface, #4A3525)",
                  border: "1px solid #6B5240",
                  borderRadius: 8,
                  color: "var(--text-primary, #F5E6D0)",
                  padding: "7px 12px",
                  fontSize: 12,
                  outline: "none",
                  flex: 1,
                  minWidth: 160,
                }}
              >
                <option value="all">All Sites</option>
                {sites.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() =>
                  exportCSV(
                    filtered,
                    `deliveries-${format(new Date(), "yyyy-MM-dd")}.csv`
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--accent, #E8461E)",
                  color: "var(--text-primary, #F5E6D0)",
                  border: "none",
                  borderRadius: 20,
                  padding: "7px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            {/* Transaction list */}
            <div style={card}>
              {isLoading ? (
                <div style={{ color: "var(--text-secondary, #C4A882)", fontSize: 13, textAlign: "center", padding: 20 }}>
                  Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ color: "var(--text-secondary, #C4A882)", fontSize: 13, textAlign: "center", padding: 20 }}>
                  No deliveries found
                </div>
              ) : (
                filtered.map((t: any, i: number) => (
                  <div
                    key={t.id || i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: i > 0 ? "1px solid #6B5240" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{t.nombre_cliente1}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary, #C4A882)" }}>
                        {t.date ? format(parseISO(t.date), "EEE dd MMM yyyy") : "—"}
                        {t.factura ? ` · #${t.factura}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {(t.cantidad || 0).toLocaleString()}L
                      </span>
                      <button
                        onClick={() => openDocket(t, demoSuffix)}
                        title="Download docket"
                        style={{
                          background: "transparent",
                          border: "1px solid #6B5240",
                          borderRadius: 6,
                          color: "var(--text-muted, #9B8060)",
                          cursor: "pointer",
                          padding: "5px 8px",
                          display: "flex",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent, #E8461E)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #9B8060)")}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── SITES TAB ── */}
        {activeTab === "Sites" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {siteBreakdown.map((s, i) => (
              <div key={s.site} style={card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <MapPin className="w-3.5 h-3.5" style={{ color: "var(--accent, #E8461E)" }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{s.site}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary, #C4A882)" }}>
                      {s.count} deliveries · Last:{" "}
                      {s.lastDate ? format(parseISO(s.lastDate), "dd MMM") : "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      {s.litres.toLocaleString()}L
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary, #C4A882)", marginTop: 2 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 60,
                          height: 4,
                          borderRadius: 2,
                          background: "var(--surface-border, #6B5240)",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            width: `${Math.min((s.litres / (siteBreakdown[0]?.litres || 1)) * 100, 100)}%`,
                            background: "var(--accent, #E8461E)",
                            borderRadius: 2,
                          }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SCHEDULED TAB ── */}
        {activeTab === "Scheduled" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scheduled.length === 0 ? (
              <div
                style={{
                  ...card,
                  textAlign: "center",
                  padding: 40,
                }}
              >
                <Calendar className="w-8 h-8" style={{ color: "var(--text-secondary, #C4A882)", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "var(--text-secondary, #C4A882)", margin: 0 }}>
                  No upcoming deliveries scheduled
                </p>
                <p style={{ fontSize: 12, color: "var(--text-secondary, #C4A882)", margin: "6px 0 0" }}>
                  Contact your supplier to arrange your next delivery
                </p>
              </div>
            ) : (
              scheduled.map((s: any) => (
                <div key={s.id} style={card}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                        {s.site_name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--accent, #E8461E)" }}>
                        {format(parseISO(s.scheduled_date), "EEEE dd MMM yyyy")}
                      </div>
                      {s.notes && (
                        <p style={{ fontSize: 11, color: "var(--text-secondary, #C4A882)", margin: "6px 0 0" }}>
                          {s.notes}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {s.estimated_litres && (
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          ~{s.estimated_litres.toLocaleString()}L
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 10,
                          color: s.status === "scheduled" ? "var(--accent, #E8461E)" : "#10B981",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginTop: 4,
                        }}
                      >
                        {s.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
