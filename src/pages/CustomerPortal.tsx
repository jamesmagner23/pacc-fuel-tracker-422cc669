import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { format, parseISO, startOfMonth, startOfQuarter, subMonths, endOfMonth, addDays } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { PACCLogo } from "@/components/PACCLogo";
import { TruckMap } from "@/components/TruckMap";
import { logActivity } from "@/hooks/useActivityLog";
import { useDemo } from "@/hooks/useDemo";
import { getDemoData, DEMO_CLIENT_ACCOUNTS } from "@/data/demoData";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PlantBoard } from "@/components/customer/PlantBoard";
import { usePlantItems } from "@/hooks/usePlantItems";
import { useProjects, useProjectAssignments } from "@/hooks/useProjects";

// ─── Theme tokens — match the rest of the PACC site ──────────────────
const T = {
  bg: "#3D2B1A",
  surface: "#4A3525",
  surfaceRaised: "#56402E",
  border: "#6B5240",
  borderSubtle: "#56402E",
  accent: "#E8461E",
  accentHover: "#D13A14",
  text: "#F5E6D0",
  textSecondary: "#C4A882",
  muted: "#8B7355",
  sansHead: "'Inter', system-ui, sans-serif",
  sansBody: "'Inter', system-ui, sans-serif",
  badgePending: "#8B7355",
  badgeConfirmed: "#E8461E",
  badgeCompleted: "#10B981",
};

const tabs = [
  "01 Overview",
  "02 Dockets",
  "03 Sites",
  "04 Plant",
  "05 FTC",
  "06 Schedule",
] as const;
type Tab = (typeof tabs)[number];

const CO2_FACTOR = 2.68; // kg CO2e per litre diesel (Australian NGA)

// ─── Helpers ─────────────────────────────────────────────────────────
const fmtL = (n: number) => `${Math.round(n).toLocaleString()}L`;
const fmtNum = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

function startOfFY(d: Date) {
  // Australian FY: 1 July - 30 June
  const y = d.getFullYear();
  return d.getMonth() >= 6 ? new Date(y, 6, 1) : new Date(y - 1, 6, 1);
}

function fyLabel(d: Date) {
  const s = startOfFY(d);
  const a = s.getFullYear();
  return `FY${String(a).slice(-2)}/${String(a + 1).slice(-2)}`;
}

// ─── Data hooks ──────────────────────────────────────────────────────
function useCustomerProfile() {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["customer-profile", isDemo],
    queryFn: async () => {
      if (isDemo) {
        const a = DEMO_CLIENT_ACCOUNTS[0];
        return {
          user_id: "u3",
          role: "client",
          client_account_id: a.id,
          companyName: a.company_name,
          speedsolNames: a.speedsol_names,
        };
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .single();
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

function useCustomerTransactions(speedsolNames: string[]) {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["customer-transactions-all", speedsolNames, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return getDemoData().transactions.filter((t) =>
          speedsolNames.includes(t.nombre_cliente1 || "")
        );
      }
      if (speedsolNames.length === 0) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .in("nombre_cliente1", speedsolNames)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: speedsolNames.length > 0,
  });
}

function useFtcRates() {
  return useQuery({
    queryKey: ["ftc-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ftc_rates")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });
}

function useDeliveryRequests(clientAccountId: number | null) {
  return useQuery({
    queryKey: ["delivery-requests", clientAccountId],
    queryFn: async () => {
      if (!clientAccountId) return [];
      const { data, error } = await supabase
        .from("delivery_requests")
        .select("*")
        .eq("client_account_id", clientAccountId)
        .order("preferred_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientAccountId,
  });
}

// ─── Reusable styles ─────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: "16px 18px",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${T.border}`,
  color: T.muted,
  padding: "9px 16px",
  fontSize: 12,
  fontFamily: T.sansHead,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderRadius: 4,
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.15s",
};

const inputStyle: React.CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  color: T.text,
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: T.sansBody,
  borderRadius: 4,
  outline: "none",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: T.sansHead,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: T.muted,
  display: "block",
  marginBottom: 6,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontFamily: T.sansHead,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: T.text,
  margin: 0,
};

const muted = (s: number = 12): React.CSSProperties => ({
  fontSize: s,
  color: T.muted,
  fontFamily: T.sansBody,
});

// ─── Ghost button hover wrapper ──────────────────────────────────────
function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...ghostBtn, opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = T.accent;
        e.currentTarget.style.color = T.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.color = T.muted;
      }}
    >
      {children}
    </button>
  );
}

// ─── CSV export helpers ──────────────────────────────────────────────
function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ──────────────────────────────────────────────────
export default function CustomerPortal() {
  const [activeTab, setActiveTab] = useState<Tab>("01 Overview");
  const isDemo = useDemo();
  const [params] = useSearchParams();
  const demoSuffix = isDemo ? `?${params.toString()}` : "";

  const { data: profile } = useCustomerProfile();
  const speedsolNames = profile?.speedsolNames || [];
  const companyName = profile?.companyName || "Your Account";
  const clientAccountId = profile?.client_account_id || null;

  const { data: transactions = [], isLoading } = useCustomerTransactions(speedsolNames);

  useEffect(() => {
    logActivity("page_view", { page: "customer_portal" });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div style={{ minHeight: isDemo ? undefined : "100vh", background: T.bg, color: T.text, fontFamily: T.sansBody }}>
      {!isDemo && (
        <div
          style={{
            borderBottom: `1px solid ${T.border}`,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <PACCLogo />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, fontFamily: T.sansHead, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
              {companyName}
            </span>
            <button
              onClick={handleSignOut}
              style={{
                background: "transparent",
                border: "none",
                color: T.muted,
                fontSize: 11,
                fontFamily: T.sansHead,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 40px" }}>
        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontFamily: T.sansHead, fontWeight: 700, letterSpacing: "0.02em", margin: 0, textTransform: "uppercase" }}>
            {companyName}
          </h1>
          <p style={{ ...muted(12), margin: "4px 0 0", letterSpacing: "0.04em" }}>
            Customer portal — volume &amp; compliance
          </p>
        </div>

        {/* Tab strip — horizontal scroll on mobile */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: `1px solid ${T.border}`,
            marginBottom: 24,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "12px 14px",
                  fontSize: 11,
                  fontFamily: T.sansHead,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: active ? T.text : T.muted,
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${active ? T.accent : "transparent"}`,
                  cursor: "pointer",
                  marginBottom: -1,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {isLoading && activeTab !== "05 Schedule" && activeTab !== "04 FTC" ? (
          <p style={muted(13)}>Loading...</p>
        ) : (
          <>
            {activeTab === "01 Overview" && <OverviewTab transactions={transactions} demoSuffix={demoSuffix} />}
            {activeTab === "02 Dockets" && <DeliveriesTab transactions={transactions} demoSuffix={demoSuffix} />}
            {activeTab === "03 Sites" && <SitesTab transactions={transactions} companyName={companyName} />}
            {activeTab === "04 FTC" && <FtcTab transactions={transactions} />}
            {activeTab === "05 Schedule" && <ScheduleTab transactions={transactions} clientAccountId={clientAccountId} />}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 01 OVERVIEW (preserved — no pricing, simplified to spec rules)
// ═══════════════════════════════════════════════════════════════════════
function OverviewTab({ transactions, demoSuffix }: { transactions: any[]; demoSuffix: string }) {
  const { data: rates = [] } = useFtcRates();
  const recent = transactions.slice(0, 6);
  const totalLitres = transactions.reduce((s, t) => s + (t.cantidad || 0), 0);
  const sites = new Set(transactions.map((t) => t.nombre_cliente1).filter(Boolean));

  // FTC savings — apply off-road / plant rate to total litres as a conservative estimate
  const ftcRate = useMemo(() => {
    const off = rates.find((r: any) => /off-road|machinery|plant/i.test(r.equipment_type));
    return Number((off || rates[0])?.rate_per_litre || 0);
  }, [rates]);
  const ftcSavings = totalLitres * ftcRate;

  // Plant breakdown — group by placa (plate / plant identifier)
  const plantBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      const key = (t.placa || t.identificador_cliente1 || "Unassigned").toString().trim() || "Unassigned";
      map.set(key, (map.get(key) || 0) + (t.cantidad || 0));
    });
    return Array.from(map.entries())
      .map(([name, litres]) => ({ name, litres }))
      .sort((a, b) => b.litres - a.litres);
  }, [transactions]);
  const topPlants = plantBreakdown.slice(0, 6);
  const topPlant = plantBreakdown[0];

  const PIE_COLORS = ["#E8461E", "#FF6B42", "#F5E6D0", "#C4A882", "#D88B5C", "#8B7355"];

  const kpis = [
    { label: "Total Litres", value: fmtL(totalLitres) },
    { label: "Deliveries", value: transactions.length.toLocaleString() },
    { label: "Sites", value: sites.size.toString() },
    {
      label: "Est. FTC Savings",
      value: ftcSavings > 0 ? `$${Math.round(ftcSavings).toLocaleString()}` : "—",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={card}>
            <div style={labelStyle}>{k.label}</div>
            <div style={{ fontSize: 24, fontFamily: T.sansHead, fontWeight: 700, color: T.text, fontVariantNumeric: "tabular-nums" }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Live truck location */}
      <TruckMap height={260} showStops={true} />

      {/* Plant analytics — donut + top plant */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div style={card}>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Plant Fuel Usage</div>
          <div style={{ ...muted(11), marginBottom: 12 }}>Volume share by plate / plant</div>
          {topPlants.length === 0 ? (
            <p style={muted(13)}>No plant data yet.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topPlants}
                      dataKey="litres"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={38}
                      strokeWidth={0}
                    >
                      {topPlants.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12 }}
                      formatter={(v: any) => fmtL(Number(v))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 6 }}>
                {topPlants.map((p, i) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ color: T.textSecondary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtL(p.litres)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Highest Plant User</div>
          <div style={{ ...muted(11), marginBottom: 16 }}>Top fuel consumer this period</div>
          {topPlant ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.sansHead, marginBottom: 4 }}>
                {topPlant.name}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: T.accent, fontFamily: T.sansHead, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                {fmtL(topPlant.litres)}
              </div>
              <div style={{ ...muted(11), marginTop: 4 }}>
                {totalLitres > 0 ? `${((topPlant.litres / totalLitres) * 100).toFixed(1)}% of total volume` : ""}
              </div>
              {plantBreakdown.length > 1 && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>Runner-up</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: T.textSecondary }}>{plantBreakdown[1].name}</span>
                    <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtL(plantBreakdown[1].litres)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={muted(13)}>No plant data yet.</p>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>Recent Deliveries</div>
        {recent.length === 0 ? (
          <p style={muted(13)}>No deliveries recorded for this period.</p>
        ) : (
          recent.map((t, i) => (
            <div
              key={t.id || i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderTop: i > 0 ? `1px solid ${T.border}` : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: T.text }}>{t.nombre_cliente1}</div>
                <div style={muted(11)}>
                  {t.date ? format(parseISO(t.date), "EEE dd MMM yyyy") : "—"}
                </div>
              </div>
              <div style={{ fontSize: 14, fontFamily: T.sansHead, fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums" }}>
                {fmtL(t.cantidad || 0)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 02 DELIVERIES (preserved — no pricing)
// ═══════════════════════════════════════════════════════════════════════
function DeliveriesTab({ transactions, demoSuffix }: { transactions: any[]; demoSuffix: string }) {
  const [siteFilter, setSiteFilter] = useState("all");
  const sites = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.nombre_cliente1).filter(Boolean))) as string[],
    [transactions]
  );
  const filtered = siteFilter === "all" ? transactions : transactions.filter((t) => t.nombre_cliente1 === siteFilter);

  const exportDeliveries = () => {
    const rows: (string | number)[][] = [["Date", "Site", "Litres", "Invoice"]];
    filtered.forEach((t) =>
      rows.push([t.date || "", t.nombre_cliente1 || "", (t.cantidad || 0).toFixed(2), t.factura || ""])
    );
    downloadCSV(rows, `deliveries-${format(new Date(), "yyyy-MM-dd")}.csv`);
    logActivity("export", { type: "deliveries-csv", rows: filtered.length });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 180 }}>
          <option value="all">All Sites</option>
          {sites.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <GhostButton onClick={exportDeliveries}>Export CSV</GhostButton>
      </div>

      <div style={card}>
        {filtered.length === 0 ? (
          <p style={muted(13)}>No deliveries recorded for this period.</p>
        ) : (
          filtered.map((t, i) => (
            <div
              key={t.id || i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0",
                borderTop: i > 0 ? `1px solid ${T.border}` : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: T.text }}>{t.nombre_cliente1}</div>
                <div style={muted(11)}>
                  {t.date ? format(parseISO(t.date), "EEE dd MMM yyyy") : "—"}
                  {t.factura ? ` · #${t.factura}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontFamily: T.sansHead, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmtL(t.cantidad || 0)}
                </span>
                <button
                  onClick={() => window.open(`/docket/${t.id}${demoSuffix}`, "_blank")}
                  style={{
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    color: T.muted,
                    fontSize: 10,
                    fontFamily: T.sansHead,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "5px 10px",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Docket
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 03 SITES — MTD/YTD by site, sortable, CSV (volume only)
// ═══════════════════════════════════════════════════════════════════════
function SitesTab({ transactions, companyName }: { transactions: any[]; companyName: string }) {
  const [sortKey, setSortKey] = useState<"site" | "mtd" | "ytd">("ytd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const fyStart = format(startOfFY(today), "yyyy-MM-dd");

  const breakdown = useMemo(() => {
    const map: Record<string, { mtd: number; ytd: number }> = {};
    transactions.forEach((t) => {
      const site = t.nombre_cliente1 || "Unknown";
      if (!map[site]) map[site] = { mtd: 0, ytd: 0 };
      const d = t.date || "";
      const litres = t.cantidad || 0;
      if (d >= fyStart) map[site].ytd += litres;
      if (d >= monthStart) map[site].mtd += litres;
    });
    return Object.entries(map).map(([site, v]) => ({ site, ...v }));
  }, [transactions, monthStart, fyStart]);

  const sorted = useMemo(() => {
    const list = [...breakdown];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "site") cmp = a.site.localeCompare(b.site);
      if (sortKey === "mtd") cmp = a.mtd - b.mtd;
      if (sortKey === "ytd") cmp = a.ytd - b.ytd;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [breakdown, sortKey, sortDir]);

  const totalMtd = sorted.reduce((s, r) => s + r.mtd, 0);
  const totalYtd = sorted.reduce((s, r) => s + r.ytd, 0);

  const handleSort = (k: "site" | "mtd" | "ytd") => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const exportSites = () => {
    const rows: (string | number)[][] = [["Site", "Period", "Litres"]];
    sorted.forEach((r) => {
      rows.push([r.site, `MTD ${format(today, "MMM yyyy")}`, r.mtd.toFixed(2)]);
      rows.push([r.site, `YTD ${fyLabel(today)}`, r.ytd.toFixed(2)]);
    });
    const fname = `PACC-Sites-${companyName.replace(/\s+/g, "-").toUpperCase()}-${format(today, "yyyyMMdd")}.csv`;
    downloadCSV(rows, fname);
    logActivity("export", { type: "sites-csv", rows: sorted.length });
  };

  const HeaderCell = ({ k, label, align = "left" }: { k: "site" | "mtd" | "ytd"; label: string; align?: "left" | "right" }) => (
    <th
      onClick={() => handleSort(k)}
      style={{
        textAlign: align,
        padding: "10px 12px",
        cursor: "pointer",
        userSelect: "none",
        fontSize: 10,
        fontFamily: T.sansHead,
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: sortKey === k ? T.accent : T.muted,
        borderBottom: `1px solid ${T.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label} {sortKey === k && (sortDir === "asc" ? "↑" : "↓")}
    </th>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={sectionTitle}>Sites</h2>
        <GhostButton onClick={exportSites} disabled={sorted.length === 0}>Export CSV</GhostButton>
      </div>

      {sorted.length === 0 ? (
        <p style={muted(13)}>No deliveries recorded for this period.</p>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.sansBody }}>
            <thead>
              <tr>
                <HeaderCell k="site" label="Site" />
                <HeaderCell k="mtd" label="Litres MTD" align="right" />
                <HeaderCell k="ytd" label="Litres YTD" align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.site} style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <td style={{ padding: "12px", fontSize: 13, color: T.text }}>{r.site}</td>
                  <td style={{ padding: "12px", fontSize: 13, color: T.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtL(r.mtd)}
                  </td>
                  <td style={{ padding: "12px", fontSize: 13, color: T.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtL(r.ytd)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ padding: "12px", fontSize: 11, fontFamily: T.sansHead, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>Total</td>
                <td style={{ padding: "12px", fontSize: 13, color: T.text, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmtL(totalMtd)}
                </td>
                <td style={{ padding: "12px", fontSize: 13, color: T.text, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmtL(totalYtd)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p style={muted(11)}>
        MTD = {format(today, "MMMM yyyy")} · YTD = {fyLabel(today)} (Australian financial year, 1 July – 30 June)
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 04 FTC — calculator with editable rows + DB-driven rates
// ═══════════════════════════════════════════════════════════════════════
type FtcRow = { id: string; equipmentType: string; litres: number };
type Period = "monthly" | "quarterly" | "annual";

function FtcTab({ transactions }: { transactions: any[] }) {
  const { data: rates = [], isLoading } = useFtcRates();
  const [period, setPeriod] = useState<Period>("monthly");
  const [rows, setRows] = useState<FtcRow[]>([]);
  const [didSeed, setDidSeed] = useState(false);

  // Compute average monthly delivered litres from the last 3 full months of delivery history
  const avgMonthlyLitres = useMemo(() => {
    const today = new Date();
    const startWindow = startOfMonth(subMonths(today, 3));
    const endWindow = endOfMonth(subMonths(today, 1));
    const startStr = format(startWindow, "yyyy-MM-dd");
    const endStr = format(endWindow, "yyyy-MM-dd");
    const inWindow = transactions.filter((t) => {
      const d = t.date || "";
      return d >= startStr && d <= endStr;
    });
    const total = inWindow.reduce((s, t) => s + (t.cantidad || 0), 0);
    return total / 3;
  }, [transactions]);

  // Seed first row with the off-road equipment type and the average monthly delivered litres
  useEffect(() => {
    if (didSeed || rates.length === 0) return;
    const offRoad = rates.find((r: any) => /off-road|machinery|plant/i.test(r.equipment_type)) || rates[0];
    setRows([
      {
        id: crypto.randomUUID(),
        equipmentType: offRoad.equipment_type,
        litres: Math.round(avgMonthlyLitres),
      },
    ]);
    setDidSeed(true);
  }, [rates, avgMonthlyLitres, didSeed]);

  const periodMultiplier = period === "monthly" ? 1 : period === "quarterly" ? 3 : 12;

  const calc = useMemo(() => {
    let monthlyTotal = 0;
    let monthlyLitres = 0;
    rows.forEach((r) => {
      const rate = rates.find((rt: any) => rt.equipment_type === r.equipmentType);
      monthlyLitres += r.litres || 0;
      if (rate) monthlyTotal += (r.litres || 0) * Number(rate.rate_per_litre);
    });
    const periodTotal = monthlyTotal * periodMultiplier;
    const annualTotal = monthlyTotal * 12;
    return { periodTotal, annualTotal, monthlyLitres };
  }, [rows, rates, periodMultiplier]);

  const addRow = () =>
    setRows([
      ...rows,
      { id: crypto.randomUUID(), equipmentType: rates[0]?.equipment_type || "", litres: 0 },
    ]);
  const removeRow = (id: string) => setRows(rows.length > 1 ? rows.filter((r) => r.id !== id) : rows);
  const updateRow = (id: string, patch: Partial<FtcRow>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  if (isLoading) return <p style={muted(13)}>Loading...</p>;

  const hasHistory = avgMonthlyLitres > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={sectionTitle}>Fuel Tax Credits</h2>
        <div style={{ display: "flex", gap: 0, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          {(["monthly", "quarterly", "annual"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "8px 14px",
                fontSize: 11,
                fontFamily: T.sansBody,
                fontWeight: 500,
                letterSpacing: "0.02em",
                color: period === p ? "#ffffff" : T.textSecondary,
                background: period === p ? T.accent : "transparent",
                border: "none",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Hint about source data */}
      {hasHistory ? (
        <div style={{ ...card, borderLeft: `3px solid ${T.accent}`, padding: "12px 16px" }}>
          <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: T.sansBody }}>
            Pre-filled from your delivery history — average{" "}
            <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              {fmtL(avgMonthlyLitres)}
            </span>{" "}
            per month over the last 3 months. Adjust the litres per equipment type to match your actual usage mix.
          </div>
        </div>
      ) : (
        <div style={{ ...card, borderLeft: `3px solid ${T.border}`, padding: "12px 16px" }}>
          <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: T.sansBody }}>
            No delivery history yet — enter your monthly litres manually to estimate your fuel tax credit savings.
          </div>
        </div>
      )}

      {/* Result block */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={labelStyle}>{period === "annual" ? "Annual" : period === "quarterly" ? "Quarterly" : "Monthly"} Estimated Saving</div>
            <div style={{ fontSize: 32, fontFamily: T.sansHead, fontWeight: 600, color: T.accent, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              ${fmtNum(calc.periodTotal, 2)}
            </div>
            <div style={{ ...muted(11), marginTop: 6 }}>
              Based on {fmtL(calc.monthlyLitres)} / month
            </div>
          </div>
          <div>
            <div style={labelStyle}>Annual Equivalent</div>
            <div style={{ fontSize: 32, fontFamily: T.sansHead, fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              ${fmtNum(calc.annualTotal, 2)}
            </div>
            <div style={{ ...muted(11), marginTop: 6 }}>Projected 12-month saving</div>
          </div>
        </div>
      </div>

      {/* Equipment rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const rate = rates.find((rt: any) => rt.equipment_type === r.equipmentType);
          const monthlyCredit = (r.litres || 0) * Number(rate?.rate_per_litre || 0);
          return (
            <div key={r.id} style={card}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
                <div>
                  <label style={labelStyle}>Equipment / Use Type</label>
                  <select
                    value={r.equipmentType}
                    onChange={(e) => updateRow(r.id, { equipmentType: e.target.value })}
                    style={inputStyle}
                  >
                    {rates.map((rt: any) => (
                      <option key={rt.id} value={rt.equipment_type}>
                        {rt.equipment_type} — ${Number(rt.rate_per_litre).toFixed(3)}/L
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Litres / Month</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={r.litres || ""}
                    onChange={(e) => updateRow(r.id, { litres: parseFloat(e.target.value) || 0 })}
                    style={inputStyle}
                    placeholder="0"
                  />
                </div>
                <button
                  onClick={() => removeRow(r.id)}
                  disabled={rows.length === 1}
                  style={{
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    color: T.textSecondary,
                    padding: "10px 14px",
                    fontSize: 11,
                    fontFamily: T.sansBody,
                    fontWeight: 500,
                    borderRadius: 6,
                    cursor: rows.length === 1 ? "not-allowed" : "pointer",
                    opacity: rows.length === 1 ? 0.4 : 1,
                  }}
                >
                  Remove
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: T.textSecondary, fontFamily: T.sansBody }}>
                Estimated monthly saving:{" "}
                <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  ${fmtNum(monthlyCredit, 2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <GhostButton onClick={addRow}>+ Add Equipment</GhostButton>
      </div>

      <p style={{ ...muted(11), lineHeight: 1.5, marginTop: 8 }}>
        Rates effective Feb 2025. Claim on BAS label 7C. Indexed by the ATO every February and August.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 05 EMISSIONS — CO2e calc + jsPDF report
// ═══════════════════════════════════════════════════════════════════════
type EmissionPeriod = "month" | "quarter" | "fy";

function EmissionsTab({ transactions, companyName }: { transactions: any[]; companyName: string }) {
  const [period, setPeriod] = useState<EmissionPeriod>("month");
  const today = new Date();

  const periodInfo = useMemo(() => {
    if (period === "month") {
      return { start: startOfMonth(today), label: format(today, "MMMM yyyy"), short: format(today, "yyyyMM") };
    }
    if (period === "quarter") {
      const s = startOfQuarter(today);
      const q = Math.floor(s.getMonth() / 3) + 1;
      return { start: s, label: `Q${q} ${s.getFullYear()}`, short: `${s.getFullYear()}Q${q}` };
    }
    const s = startOfFY(today);
    return { start: s, label: fyLabel(today), short: fyLabel(today).replace("/", "-") };
  }, [period, today]);

  const startStr = format(periodInfo.start, "yyyy-MM-dd");
  const inPeriod = transactions.filter((t) => (t.date || "") >= startStr);
  const totalLitres = inPeriod.reduce((s, t) => s + (t.cantidad || 0), 0);
  const co2Kg = totalLitres * CO2_FACTOR;
  const co2Tonnes = co2Kg / 1000;

  const siteBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    inPeriod.forEach((t) => {
      const site = t.nombre_cliente1 || "Unknown";
      map[site] = (map[site] || 0) + (t.cantidad || 0);
    });
    return Object.entries(map)
      .map(([site, litres]) => ({ site, litres, kg: litres * CO2_FACTOR, tonnes: (litres * CO2_FACTOR) / 1000 }))
      .sort((a, b) => b.litres - a.litres);
  }, [inPeriod]);

  const exportPDF = () => {
    generateEmissionsPDF({
      companyName,
      periodLabel: periodInfo.label,
      totalLitres,
      co2Kg,
      co2Tonnes,
      siteBreakdown,
    });
    logActivity("export", { type: "emissions-pdf", period: periodInfo.label });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={sectionTitle}>Emissions</h2>
        <GhostButton onClick={exportPDF} disabled={totalLitres === 0}>Export PDF Report</GhostButton>
      </div>

      <div style={{ display: "flex", gap: 0, border: `1px solid ${T.border}`, borderRadius: 4, alignSelf: "flex-start" }}>
        {([
          { k: "month", l: "This Month" },
          { k: "quarter", l: "This Quarter" },
          { k: "fy", l: "Financial Year" },
        ] as { k: EmissionPeriod; l: string }[]).map((p) => (
          <button
            key={p.k}
            onClick={() => setPeriod(p.k)}
            style={{
              padding: "9px 14px",
              fontSize: 10,
              fontFamily: T.sansHead,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: period === p.k ? T.text : T.muted,
              background: period === p.k ? T.accent : "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {p.l}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={card}>
          <div style={labelStyle}>Diesel Delivered</div>
          <div style={{ fontSize: 28, fontFamily: T.sansHead, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtL(totalLitres)}
          </div>
          <div style={{ ...muted(11), marginTop: 4 }}>{periodInfo.label}</div>
        </div>
        <div style={card}>
          <div style={labelStyle}>CO₂e (Tonnes)</div>
          <div style={{ fontSize: 28, fontFamily: T.sansHead, fontWeight: 700, color: T.accent, fontVariantNumeric: "tabular-nums" }}>
            {fmtNum(co2Tonnes, 2)}
          </div>
          <div style={{ ...muted(11), marginTop: 4 }}>tonnes CO₂e</div>
        </div>
        <div style={card}>
          <div style={labelStyle}>CO₂e (Kg)</div>
          <div style={{ fontSize: 28, fontFamily: T.sansHead, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtNum(co2Kg, 0)}
          </div>
          <div style={{ ...muted(11), marginTop: 4 }}>kg CO₂e</div>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ ...labelStyle, padding: "14px 16px 8px" }}>Emissions By Site</div>
        {siteBreakdown.length === 0 ? (
          <p style={{ ...muted(13), padding: "0 16px 16px" }}>No deliveries recorded for this period.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Site", "Litres", "Kg CO₂e", "Tonnes CO₂e"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 0 ? "left" : "right",
                      padding: "10px 16px",
                      fontSize: 10,
                      fontFamily: T.sansHead,
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: T.muted,
                      borderBottom: `1px solid ${T.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {siteBreakdown.map((s, i) => (
                <tr key={s.site} style={{ borderBottom: i < siteBreakdown.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: T.text }}>{s.site}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: T.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtL(s.litres)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: T.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(s.kg, 0)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: T.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(s.tonnes, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={muted(11)}>
        Emission factor: 2.68 kg CO₂e/L (National Greenhouse Accounts, Australian Government). Reported as Scope 1 under the GHG Protocol.
      </p>
    </div>
  );
}

// ─── jsPDF emissions report (per spec layout) ────────────────────────
function generateEmissionsPDF(args: {
  companyName: string;
  periodLabel: string;
  totalLitres: number;
  co2Kg: number;
  co2Tonnes: number;
  siteBreakdown: { site: string; litres: number; kg: number; tonnes: number }[];
}) {
  const { companyName, periodLabel, totalLitres, co2Kg, co2Tonnes, siteBreakdown } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210;
  const pageH = 297;
  const m = 20; // 20mm margins
  const contentW = pageW - m * 2;

  // Background white (default)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  // ── HEADER ──
  doc.setTextColor(17, 17, 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setCharSpace(0.6);
  doc.text("PACC® ENERGY", m, m + 2);

  doc.setFontSize(11);
  doc.setCharSpace(0.4);
  const headRight = "SCOPE 1 EMISSIONS REPORT";
  const headRightW = doc.getTextWidth(headRight);
  doc.text(headRight, pageW - m - headRightW, m + 2);
  doc.setCharSpace(0);

  // Orange rule
  doc.setDrawColor(255, 77, 28);
  doc.setLineWidth(0.35); // ~1pt
  doc.line(m, m + 7, pageW - m, m + 7);

  // Client + period
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 17, 17);
  doc.text(companyName, m, m + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Reporting period: ${periodLabel}`, m, m + 19);

  // ── SUMMARY ──
  let y = m + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text("EMISSIONS SUMMARY", m, y);
  doc.setDrawColor(136, 136, 136);
  doc.setLineWidth(0.18); // ~0.5pt
  doc.line(m, y + 1.5, pageW - m, y + 1.5);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text("Total diesel delivered", m, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(17, 17, 17);
  doc.text(`${fmtNum(totalLitres, 0)}L`, m, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text("Total CO2e emissions", pageW / 2, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(17, 17, 17);
  doc.text(`${fmtNum(co2Tonnes, 2)} tonnes (${fmtNum(co2Kg, 0)} kg)`, pageW / 2, y + 5);

  // ── SITE TABLE ──
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text("EMISSIONS BY SITE", m, y);
  doc.setDrawColor(136, 136, 136);
  doc.setLineWidth(0.18);
  doc.line(m, y + 1.5, pageW - m, y + 1.5);

  y += 7;
  // Column layout
  const colSite = m;
  const colLitres = m + contentW * 0.5;
  const colKg = m + contentW * 0.7;
  const colTonnes = m + contentW * 0.9;

  // Headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text("SITE", colSite, y);
  doc.text("LITRES", colLitres + 18, y, { align: "right" });
  doc.text("KG CO2E", colKg + 18, y, { align: "right" });
  doc.text("TONNES CO2E", pageW - m, y, { align: "right" });

  y += 3;
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.1);
  doc.line(m, y, pageW - m, y);

  // Rows with alternating fill
  const rowH = 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  siteBreakdown.forEach((r, i) => {
    if (y > pageH - 50) {
      doc.addPage();
      y = m;
    }
    if (i % 2 === 0) {
      doc.setFillColor(247, 247, 247);
      doc.rect(m, y, contentW, rowH, "F");
    }
    doc.setTextColor(17, 17, 17);
    // truncate long site names
    const site = r.site.length > 38 ? r.site.slice(0, 35) + "…" : r.site;
    doc.text(site, colSite + 1, y + 5);
    doc.text(fmtNum(r.litres, 0), colLitres + 18, y + 5, { align: "right" });
    doc.text(fmtNum(r.kg, 0), colKg + 18, y + 5, { align: "right" });
    doc.text(fmtNum(r.tonnes, 2), pageW - m - 1, y + 5, { align: "right" });
    y += rowH;
  });

  // Totals row
  doc.setDrawColor(136, 136, 136);
  doc.setLineWidth(0.18);
  doc.line(m, y, pageW - m, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 17, 17);
  doc.text("TOTAL", colSite + 1, y);
  doc.text(fmtNum(totalLitres, 0), colLitres + 18, y, { align: "right" });
  doc.text(fmtNum(co2Kg, 0), colKg + 18, y, { align: "right" });
  doc.text(fmtNum(co2Tonnes, 2), pageW - m - 1, y, { align: "right" });

  // ── FOOTER ──
  const footY = pageH - m - 10;
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.18);
  doc.line(m, footY, pageW - m, footY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(136, 136, 136);
  doc.text("Prepared by PACC® ENERGY — pacc.energy", m, footY + 4);
  const genStr = `Generated ${format(new Date(), "dd MMMM yyyy")}`;
  doc.text(genStr, pageW - m, footY + 4, { align: "right" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  const disclaimer =
    "Diesel combustion emissions reported as Scope 1 under the GHG Protocol. Emission factor: 2.68 kg CO2e/L (National Greenhouse Accounts, Australian Government).";
  const wrapped = doc.splitTextToSize(disclaimer, contentW);
  doc.text(wrapped, pageW / 2, footY + 9, { align: "center" });

  // Save
  const cleanCompany = companyName.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase();
  const cleanPeriod = periodLabel.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase();
  doc.save(`PACC-Emissions-${cleanCompany}-${cleanPeriod}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// 07 SCHEDULE — request a delivery + history
// ═══════════════════════════════════════════════════════════════════════
function ScheduleTab({ transactions, clientAccountId }: { transactions: any[]; clientAccountId: number | null }) {
  const qc = useQueryClient();
  const { data: requests = [], isLoading } = useDeliveryRequests(clientAccountId);

  const sites = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.nombre_cliente1).filter(Boolean))) as string[],
    [transactions]
  );

  const [siteName, setSiteName] = useState("");
  const [litres, setLitres] = useState("");
  const [date, setDate] = useState(format(addDays(new Date(), 3), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!siteName && sites.length > 0) setSiteName(sites[0]);
  }, [sites, siteName]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!clientAccountId) throw new Error("No customer account linked.");
      if (!siteName) throw new Error("Please select a site.");
      if (!date) throw new Error("Please choose a preferred delivery date.");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("delivery_requests").insert({
        client_account_id: clientAccountId,
        site_name: siteName,
        estimated_litres: litres ? parseFloat(litres) : null,
        preferred_date: date,
        notes: notes || null,
        status: "pending",
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg({ type: "ok", text: "Request submitted. We'll confirm shortly." });
      setLitres("");
      setNotes("");
      setDate(format(addDays(new Date(), 3), "yyyy-MM-dd"));
      qc.invalidateQueries({ queryKey: ["delivery-requests", clientAccountId] });
      logActivity("delivery_request", { site: siteName });
    },
    onError: (e: any) => setMsg({ type: "err", text: e.message || "Could not submit request." }),
  });

  const statusColor = (s: string) =>
    s === "confirmed" ? T.badgeConfirmed : s === "completed" ? T.badgeCompleted : T.badgePending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={sectionTitle}>Schedule a Delivery</h2>

      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Site</label>
            {sites.length > 0 ? (
              <select value={siteName} onChange={(e) => setSiteName(e.target.value)} style={inputStyle}>
                {sites.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Site name" style={inputStyle} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Estimated Litres</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={litres}
              onChange={(e) => setLitres(e.target.value)}
              placeholder="e.g. 5000"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Preferred Date</label>
            <input
              type="date"
              value={date}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Access instructions, contact details, etc."
              style={{ ...inputStyle, resize: "vertical", fontFamily: T.sansBody }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 12, flexWrap: "wrap" }}>
          {msg ? (
            <div style={{ fontSize: 12, color: msg.type === "ok" ? T.badgeCompleted : "#c0392b", fontFamily: T.sansBody }}>
              {msg.text}
            </div>
          ) : <span />}
          <GhostButton onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Submitting..." : "Submit Request"}
          </GhostButton>
        </div>
      </div>

      <div>
        <h2 style={{ ...sectionTitle, marginBottom: 12 }}>Request History</h2>
        {isLoading ? (
          <p style={muted(13)}>Loading...</p>
        ) : requests.length === 0 ? (
          <p style={muted(13)}>No delivery requests yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map((r: any) => (
              <div key={r.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontFamily: T.sansHead, fontWeight: 600, color: T.text }}>{r.site_name}</div>
                    <div style={{ ...muted(11), marginTop: 2 }}>
                      Preferred: {format(parseISO(r.preferred_date), "EEE dd MMM yyyy")}
                      {r.estimated_litres ? ` · ~${fmtL(Number(r.estimated_litres))}` : ""}
                    </div>
                    {r.notes && <div style={{ ...muted(11), marginTop: 6 }}>{r.notes}</div>}
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: T.sansHead,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: T.text,
                      background: statusColor(r.status),
                      padding: "4px 10px",
                      borderRadius: 2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
