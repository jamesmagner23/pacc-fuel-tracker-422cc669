import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { format, parseISO, startOfMonth, startOfQuarter, subMonths, endOfMonth, addDays, startOfWeek, subDays } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { PACCLogo } from "@/components/PACCLogo";
import { TruckMap } from "@/components/TruckMap";
import { logActivity } from "@/hooks/useActivityLog";
import { logDemoEvent } from "@/lib/demoAnalytics";
import { useDemo } from "@/hooks/useDemo";
import { getDemoData, DEMO_CLIENT_ACCOUNTS } from "@/data/demoData";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PlantBoard } from "@/components/customer/PlantBoard";
import { usePlantItems } from "@/hooks/usePlantItems";
import { useProjects, useProjectAssignments } from "@/hooks/useProjects";
import { groupAssignmentsByPlantItem, projectForItemAt } from "@/lib/projectAttribution";
import { useFtcRates, type FtcRate } from "@/hooks/useFtcRates";
import { AccountModal } from "@/components/customer/AccountModal";
import { User as UserIcon, ChevronDown, LogOut } from "lucide-react";
import {
  usePortalFilters,
  filterTransactions,
  type PortalFilters,
} from "@/hooks/usePortalFilters";
import { PortalFilterBar } from "@/components/customer/PortalFilterBar";
import { usePlantTags, usePlantItemTagLinks } from "@/hooks/usePlantTags";
import { useTransactionOverrides } from "@/hooks/useTransactionOverrides";
import { WelcomeModal } from "@/components/customer/WelcomeModal";
import { usePortalTheme, tokensFor, themeVarsFor, type PortalTheme } from "@/lib/portalTheme";
import { PortalThemeToggle } from "@/components/portal/PortalThemeToggle";

// ─── Theme tokens — light "showcase email" palette ──────────────────
// Mutable holder. Properties get re-assigned by applyPortalTheme() below
// whenever the user toggles light/dark, so all module-scoped style
// objects (card, labelStyle, ...) that reference T see the new palette.
const T = {
  bg: "#FAF6EF",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#EDE3D2",
  borderSubtle: "#F1E8D8",
  accent: "#E8461E",
  accentHover: "#D13A14",
  text: "#3D2B1A",
  textSecondary: "#6B5240",
  muted: "#8B7355",
  sansHead: "'Inter', system-ui, sans-serif",
  sansBody: "'Inter', system-ui, sans-serif",
  badgePending: "#8B7355",
  badgeConfirmed: "#E8461E",
  badgeCompleted: "#0F8A5E",
};

/**
 * Re-write T's keys (and the precomputed style objects further down)
 * to match the active portal theme. Called once before each render
 * via a useLayoutEffect-like sync inside CustomerPortal.
 */
function applyPortalTheme(theme: PortalTheme) {
  const tk = tokensFor(theme);
  Object.assign(T, {
    bg: tk.bg,
    surface: tk.surface,
    surfaceRaised: tk.surfaceRaised,
    border: tk.border,
    borderSubtle: tk.borderSubtle,
    accent: tk.accent,
    accentHover: tk.accentHover,
    text: tk.text,
    textSecondary: tk.textSecondary,
    muted: tk.textMuted,
    badgePending: tk.badgePending,
    badgeConfirmed: tk.badgeConfirmed,
    badgeCompleted: tk.badgeCompleted,
  });
  // Refresh style objects that snapshotted T at module load.
  Object.assign(card, {
    background: T.surface,
    border: `1px solid ${T.border}`,
  });
  Object.assign(ghostBtn, {
    border: `1px solid ${T.border}`,
    color: T.muted,
  });
  Object.assign(inputStyle, {
    background: T.bg,
    border: `1px solid ${T.border}`,
    color: T.text,
  });
  Object.assign(labelStyle, { color: T.muted });
  Object.assign(sectionTitle, { color: T.text });
}

const tabs = [
  "01 Overview",
  "02 Deliveries",
  "03 Projects",
  "04 Plant",
  "05 Analytics",
  "06 Emissions",
] as const;
type Tab = (typeof tabs)[number];

// Day / Week / Month period toggle for the customer portal.
type PortalPeriod = "day" | "week" | "month" | "all";
const PERIOD_DAYS: Record<PortalPeriod, number | null> = {
  day: 1, week: 7, month: 30, all: null,
};
const PERIOD_LABELS: Record<PortalPeriod, string> = {
  day: "Today", week: "This Week", month: "This Month", all: "All Time",
};

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
          email: "demo@client.com",
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
      return { ...data, companyName, speedsolNames, email: user.email || "" };
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
  const [period, setPeriod] = useState<PortalPeriod>("month");
  const isDemo = useDemo();
  const { theme: portalTheme, vars: portalVars, tokens: portalTokens } = usePortalTheme();
  // Sync the mutable T + style objects to the active theme BEFORE this
  // render's children evaluate inline T.* references.
  applyPortalTheme(portalTheme);
  const [params] = useSearchParams();
  const demoSuffix = isDemo ? `?${params.toString()}` : "";

  const { data: profile } = useCustomerProfile();
  const speedsolNames = profile?.speedsolNames || [];
  const companyName = profile?.companyName || "Your Account";
  const clientAccountId = profile?.client_account_id || null;
  const userEmail = (profile as any)?.email || "";
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = () => setMenuOpen(false);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [menuOpen]);

  const initials = (companyName || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const { data: transactions = [], isLoading } = useCustomerTransactions(speedsolNames);

  // Shared lookups: placa → plant_item type / project assignment
  const { data: plantItemsAll = [] } = usePlantItems(clientAccountId);
  const { data: projectsAll = [] } = useProjects(clientAccountId);
  const { data: assignmentsAll = [] } = useProjectAssignments(clientAccountId);
  const { data: plantTagsAll = [] } = usePlantTags(clientAccountId);
  const { data: plantTagLinks = [] } = usePlantItemTagLinks(clientAccountId);

  const lookups = useMemo(() => {
    const placaToPlant: Record<string, string> = {};
    const placaToType: Record<string, string | null | undefined> = {};
    plantItemsAll.forEach((pi) => {
      const placa = (pi.placa || "").toString().trim();
      if (!placa) return;
      placaToPlant[placa] = pi.id;
      placaToType[placa] = pi.equipment_type;
    });
    const itemToProject: Record<string, string> = {};
    assignmentsAll.forEach((a: any) => {
      if (!a.removed_at) itemToProject[a.plant_item_id] = a.project_id;
    });
    const placaToProject: Record<string, string> = {};
    plantItemsAll.forEach((pi) => {
      const placa = (pi.placa || "").toString().trim();
      if (placa && itemToProject[pi.id]) placaToProject[placa] = itemToProject[pi.id];
    });
    // Build placa → tag IDs lookup
    const itemToTagIds: Record<string, string[]> = {};
    plantTagLinks.forEach((l) => {
      (itemToTagIds[l.plant_item_id] ||= []).push(l.tag_id);
    });
    const placaToTags: Record<string, string[]> = {};
    plantItemsAll.forEach((pi) => {
      const placa = (pi.placa || "").toString().trim();
      if (placa && itemToTagIds[pi.id]) placaToTags[placa] = itemToTagIds[pi.id];
    });
    return { placaToPlant, placaToType, placaToProject, placaToTags };
  }, [plantItemsAll, assignmentsAll, plantTagLinks]);

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    plantItemsAll.forEach((pi) => {
      if (pi.equipment_type) set.add(pi.equipment_type);
    });
    return Array.from(set).sort();
  }, [plantItemsAll]);

  const unmappedCount = useMemo(() => {
    let n = 0;
    transactions.forEach((t: any) => {
      const placa = (t.placa || "").toString().trim();
      if (!placa || !lookups.placaToPlant[placa]) n++;
    });
    return n;
  }, [transactions, lookups]);

  const portalFilters = usePortalFilters();
  // Apply Day/Week/Month period to the raw transactions BEFORE the
  // chip-style filter bar, so KPIs, charts and the analytics tab all
  // respect the same time window.
  const periodTransactions = useMemo(() => {
    const days = PERIOD_DAYS[period];
    if (days == null) return transactions;
    const cutoff = subDays(new Date(), days);
    cutoff.setHours(0, 0, 0, 0);
    const cutoffStr = format(cutoff, "yyyy-MM-dd");
    return transactions.filter((t: any) => (t.date || "") >= cutoffStr);
  }, [transactions, period]);
  const filteredTransactions = useMemo(
    () => filterTransactions(periodTransactions, portalFilters.filters, lookups),
    [periodTransactions, portalFilters.filters, lookups]
  );

  useEffect(() => {
    logActivity("page_view", { page: "customer_portal" });
  }, []);

  // Demo-only analytics: capture portal opens (incl. ?source=email)
  useEffect(() => {
    if (!isDemo) return;
    logDemoEvent({
      eventType: "portal_opened",
      metadata: {
        company_name: companyName,
      },
    });
  }, [isDemo, companyName]);

  // Demo-only analytics: capture which key sections the visitor reaches
  useEffect(() => {
    if (!isDemo) return;
    logDemoEvent({
      eventType: "section_viewed",
      section: activeTab,
    });
  }, [isDemo, activeTab]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div style={{ ...portalVars, minHeight: isDemo ? undefined : "100vh", background: T.bg, color: T.text, fontFamily: T.sansBody }}>
      {/* Hide the welcome/onboarding modal in demo mode — recipients want to explore, not be onboarded. */}
      {!isDemo && <WelcomeModal />}
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
          <PACCLogo tone={portalTheme === "dark" ? "dark" : "light"} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PortalThemeToggle />
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "transparent",
                border: `1px solid ${T.border}`,
                borderRadius: 999,
                padding: "6px 12px 6px 6px",
                cursor: "pointer",
                color: T.text,
              }}
              aria-label="Account menu"
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: T.accent,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontFamily: T.sansHead,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                {initials}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: T.sansHead,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.textSecondary,
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {companyName}
              </span>
              <ChevronDown size={14} style={{ color: T.muted }} />
            </button>

            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  minWidth: 220,
                  boxShadow: "0 10px 30px rgba(61,43,26,0.12)",
                  zIndex: 60,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: T.sansHead,
                      fontWeight: 600,
                      color: T.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {companyName}
                  </div>
                  {userEmail && (
                    <div
                      style={{
                        fontSize: 11,
                        color: T.muted,
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {userEmail}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setAccountOpen(true);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    color: T.text,
                    fontSize: 12,
                    fontFamily: T.sansBody,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <UserIcon size={14} style={{ color: T.muted }} />
                  My Account
                </button>
                <button
                  onClick={handleSignOut}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderTop: `1px solid ${T.border}`,
                    color: T.text,
                    fontSize: 12,
                    fontFamily: T.sansBody,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <LogOut size={14} style={{ color: T.muted }} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
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
            marginBottom: 16,
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

        {/* Day / Week / Month period toggle — applies to Overview, Deliveries,
            Plant and Analytics tabs. */}
        {(activeTab === "01 Overview" ||
          activeTab === "02 Deliveries" ||
          activeTab === "04 Plant" ||
          activeTab === "05 Analytics") && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
              {(["day", "week", "month", "all"] as PortalPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "8px 14px",
                    fontSize: 11,
                    fontFamily: T.sansHead,
                    fontWeight: period === p ? 600 : 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: period === p ? "#ffffff" : T.textSecondary,
                    background: period === p ? T.accent : "transparent",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <span style={{ ...muted(11), letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Showing {periodTransactions.length.toLocaleString()} deliveries · {PERIOD_LABELS[period]}
            </span>
          </div>
        )}

        {/* Shared filter bar — applies to Overview / Deliveries / Plant */}
        {(activeTab === "01 Overview" ||
          activeTab === "02 Deliveries" ||
          activeTab === "04 Plant") && (
          <div style={{ marginBottom: 16 }}>
            <PortalFilterBar
              filters={portalFilters.filters}
              onTypes={portalFilters.setTypes}
              onProjects={portalFilters.setProjects}
              onTags={portalFilters.setTags}
              onReset={portalFilters.reset}
              availableTypes={availableTypes}
              availableProjects={projectsAll.map((p) => ({ id: p.id, name: p.name }))}
              availableTags={plantTagsAll.map((t) => ({ id: t.id, name: t.name }))}
            />
          </div>
        )}

        {isLoading && activeTab !== "04 Plant" ? (
          <p style={muted(13)}>Loading...</p>
        ) : (
          <>
            {activeTab === "01 Overview" && (
              <OverviewTab
                transactions={filteredTransactions}
                demoSuffix={demoSuffix}
                speedsolNames={speedsolNames}
                isDemo={isDemo}
              />
            )}
            {activeTab === "02 Deliveries" && (
              <DeliveriesTab
                transactions={filteredTransactions}
                allTransactionsCount={transactions.length}
                portalFilters={portalFilters}
                unmappedCount={unmappedCount}
                unmappedPlacaSet={lookups.placaToPlant}
                demoSuffix={demoSuffix}
                clientAccountId={clientAccountId}
              />
            )}
            {activeTab === "03 Projects" && (
              <ProjectsTab transactions={periodTransactions} clientAccountId={clientAccountId} />
            )}
            {activeTab === "04 Plant" && <PlantTab clientAccountId={clientAccountId} transactions={filteredTransactions} />}
            {activeTab === "05 Analytics" && (
              <AnalyticsTab
                transactions={filteredTransactions}
                clientAccountId={clientAccountId}
                periodLabel={PERIOD_LABELS[period]}
              />
            )}
            {activeTab === "06 Emissions" && (
              <EmissionsTab transactions={transactions} companyName={companyName} />
            )}
          </>
        )}
      </div>

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        clientAccountId={clientAccountId}
        companyName={companyName}
        userEmail={userEmail}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 01 OVERVIEW (preserved — no pricing, simplified to spec rules)
// ═══════════════════════════════════════════════════════════════════════
function OverviewTab({
  transactions,
  demoSuffix,
  speedsolNames,
  isDemo,
}: {
  transactions: any[];
  demoSuffix: string;
  speedsolNames: string[];
  isDemo: boolean;
}) {
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

  // Pie palette comes from the active portal theme so it stays legible
  // on either cream or deep-brown backgrounds.
  const { tokens: pieTokens } = usePortalTheme();
  const PIE_COLORS = pieTokens.pie as unknown as string[];

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
// 02 DELIVERIES — site + project + date range filter, CSV export, dockets
// ═══════════════════════════════════════════════════════════════════════
function DeliveriesTab({
  transactions,
  allTransactionsCount,
  portalFilters,
  unmappedCount,
  unmappedPlacaSet,
  demoSuffix,
  clientAccountId,
}: {
  transactions: any[];
  allTransactionsCount: number;
  portalFilters: ReturnType<typeof usePortalFilters>;
  unmappedCount: number;
  /** placa → plant_item.id (presence used to detect unmapped). */
  unmappedPlacaSet: Record<string, string>;
  demoSuffix: string;
  clientAccountId: number | null;
}) {
  const { data: projects = [] } = useProjects(clientAccountId);
  const { data: assignments = [] } = useProjectAssignments(clientAccountId);
  const { data: plantItems = [] } = usePlantItems(clientAccountId);

  // Per-transaction overrides set by drivers/admins
  const txnIds = useMemo(
    () => transactions.map((t: any) => Number(t.id)).filter((n) => Number.isFinite(n)),
    [transactions]
  );
  const { data: overrides = {} } = useTransactionOverrides(txnIds);

  const plantById = useMemo(() => {
    const m: Record<string, typeof plantItems[number]> = {};
    plantItems.forEach((pi) => { m[pi.id] = pi; });
    return m;
  }, [plantItems]);

  const [siteFilter, setSiteFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const sites = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.nombre_cliente1).filter(Boolean))) as string[],
    [transactions]
  );

  // Build placa → projectId map from assignments + plant items
  const placaToProject = useMemo(() => {
    const itemToProject: Record<string, string> = {};
    assignments.forEach((a) => {
      if (!a.removed_at) itemToProject[a.plant_item_id] = a.project_id;
    });
    const map: Record<string, string> = {};
    plantItems.forEach((pi) => {
      const placa = (pi.placa || "").toString().trim();
      if (placa && itemToProject[pi.id]) map[placa] = itemToProject[pi.id];
    });
    return map;
  }, [assignments, plantItems]);

  // Build placa → enriched plant item lookup (alias / colour / type / notes)
  const placaToPlant = useMemo(() => {
    const map: Record<string, typeof plantItems[number]> = {};
    plantItems.forEach((pi) => {
      const placa = (pi.placa || "").toString().trim();
      if (placa) map[placa] = pi;
    });
    return map;
  }, [plantItems]);

  const projectById = useMemo(() => {
    const m: Record<string, typeof projects[number]> = {};
    projects.forEach((p) => { m[p.id] = p; });
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (siteFilter !== "all" && t.nombre_cliente1 !== siteFilter) return false;
      if (projectFilter !== "all") {
        const placa = (t.placa || "").toString().trim();
        if (placaToProject[placa] !== projectFilter) return false;
      }
      const d = t.date || "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [transactions, siteFilter, projectFilter, placaToProject, fromDate, toDate]);

  const exportDeliveries = () => {
    const rows: (string | number)[][] = [
      ["Date", "Site", "Plant/Placa", "Project", "Litres", "Invoice"],
    ];
    const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "";
    filtered.forEach((t) => {
      const placa = (t.placa || "").toString().trim();
      rows.push([
        t.date || "",
        t.nombre_cliente1 || "",
        placa,
        projectName(placaToProject[placa] || ""),
        (t.cantidad || 0).toFixed(2),
        t.factura || "",
      ]);
    });
    downloadCSV(rows, `deliveries-${format(new Date(), "yyyy-MM-dd")}.csv`);
    logActivity("export", { type: "deliveries-csv", rows: filtered.length });
  };

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);

  // Unique unmapped placas (across ALL transactions, not just current filter)
  // so the bulk tool always shows the full backlog.
  const unmappedPlacaList = useMemo(() => {
    const map = new Map<string, { count: number; litres: number }>();
    transactions.forEach((t) => {
      const placa = (t.placa || "").toString().trim();
      if (!placa) return;
      if (unmappedPlacaSet[placa]) return; // already mapped
      const cur = map.get(placa) || { count: 0, litres: 0 };
      cur.count += 1;
      cur.litres += t.cantidad || 0;
      map.set(placa, cur);
    });
    return Array.from(map.entries())
      .map(([placa, v]) => ({ placa, ...v }))
      .sort((a, b) => b.litres - a.litres);
  }, [transactions, unmappedPlacaSet]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {unmappedCount > 0 && (
        <div
          style={{
            fontSize: 11,
            color: T.muted,
            fontStyle: "italic",
            padding: "4px 2px",
          }}
        >
          Equipment names are assigned by our team — some deliveries may show the truck rego while we update them.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} style={inputStyle}>
          <option value="all">All Sites</option>
          {sites.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={inputStyle}>
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} placeholder="From" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} placeholder="To" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={muted(12)}>
          {filtered.length.toLocaleString()} deliveries · {fmtL(totalLitres)}
        </div>
        <GhostButton onClick={exportDeliveries} disabled={filtered.length === 0}>Export CSV</GhostButton>
      </div>

      <div style={card}>
        {filtered.length === 0 ? (
          <p style={muted(13)}>No deliveries recorded for this period.</p>
        ) : (
          filtered.map((t, i) => {
            const placa = (t.placa || "").toString().trim();
            const ov = overrides[Number(t.id)];
            const plant =
              (ov?.plant_item_id ? plantById[ov.plant_item_id] : undefined) ||
              (placa ? placaToPlant[placa] : undefined);
            const project =
              (ov?.project_id ? projectById[ov.project_id] : undefined) ||
              (placa ? projectById[placaToProject[placa] || ""] : undefined);
            const swatch = plant?.colour || T.border;
            return (
              <div
                key={t.id || i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "stretch", gap: 10, minWidth: 0, flex: 1 }}>
                  <div
                    aria-hidden
                    title={plant?.colour ? `Plant colour: ${plant.colour}` : undefined}
                    style={{
                      width: 3,
                      borderRadius: 2,
                      background: swatch,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T.text, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600 }}>{plant?.name || placa || t.nombre_cliente1}</span>
                      {placa && plant?.name && (
                        <span style={{ fontSize: 10, color: T.muted, fontFamily: "monospace" }}>{placa}</span>
                      )}
                      {plant?.equipment_type && (
                        <span style={{
                          fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
                          color: T.textSecondary, border: `1px solid ${T.border}`, borderRadius: 3, padding: "1px 5px",
                        }}>{plant.equipment_type}</span>
                      )}
                      {project && (
                        <span style={{
                          fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
                          color: T.accent, border: `1px solid ${T.accent}55`, background: `${T.accent}11`,
                          borderRadius: 3, padding: "1px 5px",
                        }} title={project.site_address || undefined}>{project.name}</span>
                      )}
                      {!placa && (
                        <span
                          title="No placa recorded on this delivery."
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: T.muted,
                            border: `1px solid ${T.border}`,
                            borderRadius: 3,
                            padding: "1px 5px",
                          }}
                        >
                          No placa
                        </span>
                      )}
                    </div>
                    <div style={muted(11)}>
                      {t.nombre_cliente1}
                      {" · "}
                      {t.date ? format(parseISO(t.date), "EEE dd MMM yyyy") : "—"}
                      {t.factura ? ` · #${t.factura}` : ""}
                    </div>
                    {plant?.service_notes && (
                      <div style={{ fontSize: 10, color: T.muted, marginTop: 2, fontStyle: "italic" }}>
                        {plant.service_notes}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
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
            );
          })
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
// 03 PROJECTS — per-project fuel usage analytics
// ═══════════════════════════════════════════════════════════════════════
function ProjectsTab({
  transactions,
  clientAccountId,
}: {
  transactions: any[];
  clientAccountId: number | null;
}) {
  const { data: projects = [], isLoading: prLoading } = useProjects(clientAccountId);
  const { data: assignments = [] } = useProjectAssignments(clientAccountId);
  const { data: plantItems = [] } = usePlantItems(clientAccountId);
  const txnIds = useMemo(() => transactions.map((t) => t.id).filter(Boolean), [transactions]);
  const { data: overrides = {} } = useTransactionOverrides(txnIds);

  const stats = useMemo(() => {
    // Group all assignment history by plant_item_id so we can look up the
    // project that was active on the date of each transaction. Time-aware:
    // deliveries before a move stay with the old project, deliveries after
    // belong to the new one. (See src/lib/projectAttribution.ts for tests.)
    const itemAssignments = groupAssignmentsByPlantItem(assignments as any);
    const resolveProject = (itemId: string | undefined, isoDate: string | null) =>
      projectForItemAt(itemAssignments, itemId, isoDate);

    const placaToName: Record<string, string> = {};
    const itemIdToName: Record<string, string> = {};
    const placaToItemId: Record<string, string> = {};
    plantItems.forEach((pi) => {
      itemIdToName[pi.id] = pi.name;
      const placa = (pi.placa || "").toString().trim();
      if (!placa) return;
      placaToName[placa] = pi.name;
      placaToItemId[placa] = pi.id;
    });

    const perProject: Record<
      string,
      { litres: number; deliveries: number; topPlant: Record<string, number>; weekly: Record<string, { litres: number; deliveries: number }> }
    > = {};
    let unassignedLitres = 0;
    let unassignedDeliveries = 0;

    transactions.forEach((t) => {
      const placa = (t.placa || "").toString().trim();
      const litres = t.cantidad || 0;
      const txnDate = t.fecha || (t.date ? t.date + "T00:00:00.000Z" : null);
      // Priority: direct transaction override > override.plant_item assignment > placa lookup
      const ov = overrides[t.id];
      let pid: string | undefined;
      let plantName: string | undefined;
      if (ov?.project_id) {
        pid = ov.project_id;
      }
      if (ov?.plant_item_id) {
        plantName = itemIdToName[ov.plant_item_id];
        if (!pid) pid = resolveProject(ov.plant_item_id, txnDate);
      }
      if (!pid) pid = resolveProject(placaToItemId[placa], txnDate);
      if (!plantName) plantName = placaToName[placa] || placa || "Untagged";
      if (!pid) {
        unassignedLitres += litres;
        unassignedDeliveries += 1;
        return;
      }
      if (!perProject[pid]) perProject[pid] = { litres: 0, deliveries: 0, topPlant: {}, weekly: {} };
      perProject[pid].litres += litres;
      perProject[pid].deliveries += 1;
      perProject[pid].topPlant[plantName] = (perProject[pid].topPlant[plantName] || 0) + litres;
      // Week bucket (Monday start)
      if (t.date) {
        try {
          const wkStart = format(startOfWeek(parseISO(t.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
          if (!perProject[pid].weekly[wkStart]) perProject[pid].weekly[wkStart] = { litres: 0, deliveries: 0 };
          perProject[pid].weekly[wkStart].litres += litres;
          perProject[pid].weekly[wkStart].deliveries += 1;
        } catch {}
      }
    });

    return { perProject, unassignedLitres, unassignedDeliveries };
  }, [transactions, assignments, plantItems, overrides]);

  if (prLoading) return <p style={muted(13)}>Loading...</p>;

  const totalAssigned = Object.values(stats.perProject).reduce((s, v) => s + v.litres, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={sectionTitle}>Projects</h2>
        <p style={{ ...muted(12), margin: "4px 0 0" }}>
          Fuel usage per project — assign plant items to projects on the Plant tab.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={card}>
          <div style={labelStyle}>Active Projects</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: T.sansHead, fontVariantNumeric: "tabular-nums" }}>
            {projects.length}
          </div>
        </div>
        <div style={card}>
          <div style={labelStyle}>Litres Assigned</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: T.sansHead, fontVariantNumeric: "tabular-nums" }}>
            {fmtL(totalAssigned)}
          </div>
        </div>
        <div style={card}>
          <div style={labelStyle}>Litres Unassigned</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: T.sansHead, color: T.accent, fontVariantNumeric: "tabular-nums" }}>
            {fmtL(stats.unassignedLitres)}
          </div>
          <div style={{ ...muted(11), marginTop: 4 }}>{stats.unassignedDeliveries} deliveries</div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={card}>
          <p style={muted(13)}>
            No projects yet. Create projects on the Plant tab to track fuel usage by job.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {projects.map((p) => {
            const s = stats.perProject[p.id];
            const litres = s?.litres || 0;
            const deliveries = s?.deliveries || 0;
            const co2Tonnes = (litres * CO2_FACTOR) / 1000;
            const topPlant = s
              ? Object.entries(s.topPlant).sort((a, b) => b[1] - a[1]).slice(0, 5)
              : [];
            const maxLitres = topPlant[0]?.[1] || 1;
            const weekly = s
              ? Object.entries(s.weekly).sort((a, b) => b[0].localeCompare(a[0]))
              : [];
            const maxWeekLitres = weekly.reduce((m, [, v]) => Math.max(m, v.litres), 0) || 1;
            return (
              <div key={p.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, fontFamily: T.sansHead, color: T.text }}>{p.name}</div>
                    {p.site_address && <div style={{ ...muted(11), marginTop: 2 }}>{p.site_address}</div>}
                    <div style={{ ...muted(11), marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {p.status}
                      {p.start_date ? ` · ${format(parseISO(p.start_date), "dd MMM yyyy")}` : ""}
                      {p.end_date ? ` → ${format(parseISO(p.end_date), "dd MMM yyyy")}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <div>
                      <div style={labelStyle}>Litres</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtL(litres)}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Deliveries</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{deliveries}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>CO₂e (t)</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.accent, fontVariantNumeric: "tabular-nums" }}>
                        {fmtNum(co2Tonnes, 2)}
                      </div>
                    </div>
                  </div>
                </div>

                {topPlant.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                    <div style={{ ...labelStyle, marginBottom: 8 }}>Top Fuel Users</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {topPlant.map(([name, l]) => (
                        <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                          <span style={{ color: T.textSecondary, width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{name}</span>
                          <div style={{ flex: 1, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${(l / maxLitres) * 100}%`, height: "100%", background: T.accent }} />
                          </div>
                          <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 70, textAlign: "right" }}>{fmtL(l)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {weekly.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                    <div style={{ ...labelStyle, marginBottom: 8 }}>Weekly Breakdown</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {weekly.map(([wkStart, v]) => {
                        const wkEnd = format(addDays(parseISO(wkStart), 6), "dd MMM");
                        const label = `${format(parseISO(wkStart), "dd MMM")} – ${wkEnd}`;
                        return (
                          <div key={wkStart} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                            <span style={{ color: T.textSecondary, width: 140, whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{label}</span>
                            <div style={{ flex: 1, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${(v.litres / maxWeekLitres) * 100}%`, height: "100%", background: T.accent }} />
                            </div>
                            <span style={{ color: T.muted, fontSize: 11, fontVariantNumeric: "tabular-nums", minWidth: 50, textAlign: "right" }}>{v.deliveries} dlv</span>
                            <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 70, textAlign: "right" }}>{fmtL(v.litres)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 05 EMISSIONS — CO2e calc + jsPDF report (with editable assumptions)
// ═══════════════════════════════════════════════════════════════════════
type EmissionPeriod = "month" | "quarter" | "fy";

function EmissionsTab({ transactions, companyName }: { transactions: any[]; companyName: string }) {
  const [period, setPeriod] = useState<EmissionPeriod>("month");
  const [factor, setFactor] = useState<number>(CO2_FACTOR);
  const [energyContent, setEnergyContent] = useState<number>(38.6); // GJ/kL diesel
  const [oxidationFactor, setOxidationFactor] = useState<number>(1.0);
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

  const effectiveFactor = factor * oxidationFactor;
  const startStr = format(periodInfo.start, "yyyy-MM-dd");
  const inPeriod = transactions.filter((t) => (t.date || "") >= startStr);
  const totalLitres = inPeriod.reduce((s, t) => s + (t.cantidad || 0), 0);
  const co2Kg = totalLitres * effectiveFactor;
  const co2Tonnes = co2Kg / 1000;
  const energyGJ = (totalLitres / 1000) * energyContent;

  const siteBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    inPeriod.forEach((t) => {
      const site = t.nombre_cliente1 || "Unknown";
      map[site] = (map[site] || 0) + (t.cantidad || 0);
    });
    return Object.entries(map)
      .map(([site, litres]) => ({ site, litres, kg: litres * effectiveFactor, tonnes: (litres * effectiveFactor) / 1000 }))
      .sort((a, b) => b.litres - a.litres);
  }, [inPeriod, effectiveFactor]);

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <div style={card}>
          <div style={labelStyle}>Diesel Delivered</div>
          <div style={{ fontSize: 26, fontFamily: T.sansHead, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtL(totalLitres)}
          </div>
          <div style={{ ...muted(11), marginTop: 4 }}>{periodInfo.label}</div>
        </div>
        <div style={card}>
          <div style={labelStyle}>CO₂e (Tonnes)</div>
          <div style={{ fontSize: 26, fontFamily: T.sansHead, fontWeight: 700, color: T.accent, fontVariantNumeric: "tabular-nums" }}>
            {fmtNum(co2Tonnes, 2)}
          </div>
          <div style={{ ...muted(11), marginTop: 4 }}>tonnes CO₂e (Scope 1)</div>
        </div>
        <div style={card}>
          <div style={labelStyle}>CO₂e (Kg)</div>
          <div style={{ fontSize: 26, fontFamily: T.sansHead, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtNum(co2Kg, 0)}
          </div>
          <div style={{ ...muted(11), marginTop: 4 }}>kg CO₂e</div>
        </div>
        <div style={card}>
          <div style={labelStyle}>Energy Content</div>
          <div style={{ fontSize: 26, fontFamily: T.sansHead, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtNum(energyGJ, 2)}
          </div>
          <div style={{ ...muted(11), marginTop: 4 }}>GJ (NGER)</div>
        </div>
      </div>

      {/* Editable NGER assumptions */}
      <div style={card}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>NGER Assumptions</div>
        <div style={{ ...muted(11), marginBottom: 12 }}>
          Override defaults to match your own NGER methodology before exporting.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>Emission Factor (kg CO₂e/L)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={factor}
              onChange={(e) => setFactor(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
            <div style={{ ...muted(11), marginTop: 4 }}>Default 2.68 (NGA diesel)</div>
          </div>
          <div>
            <label style={labelStyle}>Energy Content (GJ/kL)</label>
            <input
              type="number"
              step="0.1"
              min={0}
              value={energyContent}
              onChange={(e) => setEnergyContent(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
            <div style={{ ...muted(11), marginTop: 4 }}>Default 38.6 (NGER diesel)</div>
          </div>
          <div>
            <label style={labelStyle}>Oxidation Factor</label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={oxidationFactor}
              onChange={(e) => setOxidationFactor(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
            <div style={{ ...muted(11), marginTop: 4 }}>Default 1.0</div>
          </div>
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

// ═══════════════════════════════════════════════════════════════════════
// 04 PLANT — drag-and-drop board for assigning plant to projects
// ═══════════════════════════════════════════════════════════════════════
function PlantTab({
  clientAccountId,
  transactions,
}: {
  clientAccountId: number | null;
  transactions: any[];
}) {
  const { data: plantItems = [], isLoading: pLoading } = usePlantItems(clientAccountId);
  const { data: projects = [], isLoading: prLoading } = useProjects(clientAccountId);
  const { data: assignments = [] } = useProjectAssignments(clientAccountId);
  const { data: ftcRates = [] } = useFtcRates();
  const { data: tagLibrary = [] } = usePlantTags(clientAccountId);
  const { data: tagLinks = [] } = usePlantItemTagLinks(clientAccountId);

  const tagsByItem = useMemo(() => {
    const nameById: Record<string, string> = {};
    tagLibrary.forEach((t) => { nameById[t.id] = t.name; });
    const map: Record<string, string[]> = {};
    tagLinks.forEach((l) => {
      const name = nameById[l.tag_id];
      if (!name) return;
      (map[l.plant_item_id] ||= []).push(name);
    });
    Object.values(map).forEach((arr) => arr.sort());
    return map;
  }, [tagLibrary, tagLinks]);

  // Build equipment list from plant items + transaction stats keyed on placa
  const equipment = useMemo(() => {
    const stats: Record<string, { litres: number; deliveries: number }> = {};
    transactions.forEach((t) => {
      const p = (t.placa || "").toString().trim();
      if (!p) return;
      if (!stats[p]) stats[p] = { litres: 0, deliveries: 0 };
      stats[p].litres += t.cantidad || 0;
      stats[p].deliveries += 1;
    });
    return plantItems.map((pi) => ({
      placa: pi.placa,
      litres: pi.placa ? stats[pi.placa]?.litres || 0 : 0,
      deliveries: pi.placa ? stats[pi.placa]?.deliveries || 0 : 0,
      enriched: {
        id: pi.id,
        name: pi.name,
        equipment_type: pi.equipment_type,
        photo_url: pi.photo_url,
        colour: pi.colour,
        service_notes: pi.service_notes,
        ftc_rate_id: (pi as any).ftc_rate_id || null,
      },
    }));
  }, [plantItems, transactions]);

  const ftcRollup = useMemo(() => {
    const rateById: Record<string, FtcRate> = {};
    ftcRates.forEach((r) => { rateById[r.id] = r; });
    const byCategory: Record<string, { name: string; rate: number; litres: number; claim: number; items: number }> = {};
    let unclassifiedItems = 0;
    let unclassifiedLitres = 0;
    equipment.forEach((e: any) => {
      const rateId = e.enriched?.ftc_rate_id;
      const rate = rateId ? rateById[rateId] : null;
      if (!rate) {
        if (e.litres > 0) { unclassifiedItems += 1; unclassifiedLitres += e.litres; }
        return;
      }
      if (!byCategory[rate.id]) {
        byCategory[rate.id] = { name: rate.equipment_type, rate: Number(rate.rate_per_litre), litres: 0, claim: 0, items: 0 };
      }
      byCategory[rate.id].litres += e.litres;
      byCategory[rate.id].claim += e.litres * Number(rate.rate_per_litre);
      byCategory[rate.id].items += 1;
    });
    const rows = Object.values(byCategory).sort((a, b) => b.claim - a.claim);
    const totalClaim = rows.reduce((s, r) => s + r.claim, 0);
    return { rows, totalClaim, unclassifiedItems, unclassifiedLitres };
  }, [equipment, ftcRates]);

  if (!clientAccountId) {
    return <p style={muted(13)}>No account linked.</p>;
  }
  if (pLoading || prLoading) {
    return <p style={muted(13)}>Loading...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={sectionTitle}>Plant &amp; Projects</h2>
        <p style={{ ...muted(12), margin: "4px 0 0" }}>
          Drag a plant card into a project column to reassign. Each plant belongs to one project at a time.
        </p>
      </div>

      <PlantBoard
        projects={projects}
        equipment={equipment}
        assignments={assignments}
        clientAccountId={clientAccountId}
        tagsByItem={tagsByItem}
      />

      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold">Fuel Tax Credit Estimate</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Based on delivered litres × ATO rate per category. Indicative — confirm with your accountant.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Claimable</div>
            <div className="text-xl font-bold text-primary">${ftcRollup.totalClaim.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        {ftcRollup.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            None of your plant has an FTC category set. Contact PACC to have categories assigned to enable claim tracking.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3 text-right">Items</th>
                  <th className="pb-2 pr-3 text-right">Litres</th>
                  <th className="pb-2 pr-3 text-right">Rate (c/L)</th>
                  <th className="pb-2 text-right">Claim</th>
                </tr>
              </thead>
              <tbody>
                {ftcRollup.rows.map((r) => (
                  <tr key={r.name} className="border-b border-border/50">
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3 text-right">{r.items}</td>
                    <td className="py-2 pr-3 text-right">{r.litres.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right">{(r.rate * 100).toFixed(1)}</td>
                    <td className="py-2 text-right font-semibold">${r.claim.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ftcRollup.unclassifiedItems > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3">
            {ftcRollup.unclassifiedItems} item{ftcRollup.unclassifiedItems !== 1 ? "s" : ""} with {ftcRollup.unclassifiedLitres.toLocaleString()}L delivered are excluded (no FTC category set).
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 05 ANALYTICS — machinery vs machinery, project vs project comparisons
// ═══════════════════════════════════════════════════════════════════════
function AnalyticsTab({
  transactions,
  clientAccountId,
  periodLabel,
}: {
  transactions: any[];
  clientAccountId: number | null;
  periodLabel: string;
}) {
  const { data: plantItems = [] } = usePlantItems(clientAccountId);
  const { data: projects = [] } = useProjects(clientAccountId);
  const { data: assignments = [] } = useProjectAssignments(clientAccountId);
  const { data: ftcRates = [] } = useFtcRates();

  // placa → enriched item, item.id → project lookups
  const enriched = useMemo(() => {
    const placaToItem: Record<string, any> = {};
    plantItems.forEach((pi) => {
      const placa = (pi.placa || "").toString().trim();
      if (placa) placaToItem[placa] = pi;
    });
    const itemToProject: Record<string, string> = {};
    assignments.forEach((a: any) => {
      if (!a.removed_at) itemToProject[a.plant_item_id] = a.project_id;
    });
    const projectById: Record<string, any> = {};
    projects.forEach((p) => {
      projectById[p.id] = p;
    });
    const ftcById: Record<string, FtcRate> = {};
    ftcRates.forEach((r) => {
      ftcById[r.id] = r;
    });
    return { placaToItem, itemToProject, projectById, ftcById };
  }, [plantItems, projects, assignments, ftcRates]);

  // Per-machinery roll-up
  const perMachine = useMemo(() => {
    const rows: Record<
      string,
      { id: string; name: string; type: string; placa: string; colour: string | null; litres: number; deliveries: number; ftcClaim: number; projectName: string }
    > = {};
    transactions.forEach((t) => {
      const placa = (t.placa || "").toString().trim();
      if (!placa) return;
      const item = enriched.placaToItem[placa];
      if (!item) return;
      const projId = enriched.itemToProject[item.id];
      const projName = projId ? enriched.projectById[projId]?.name || "Unassigned" : "Unassigned";
      if (!rows[item.id]) {
        rows[item.id] = {
          id: item.id,
          name: item.name,
          type: item.equipment_type || "—",
          placa,
          colour: item.colour || null,
          litres: 0,
          deliveries: 0,
          ftcClaim: 0,
          projectName: projName,
        };
      }
      const litres = t.cantidad || 0;
      rows[item.id].litres += litres;
      rows[item.id].deliveries += 1;
      const ftc = item.ftc_rate_id ? enriched.ftcById[item.ftc_rate_id] : null;
      if (ftc) rows[item.id].ftcClaim += litres * Number(ftc.rate_per_litre);
    });
    return Object.values(rows).sort((a, b) => b.litres - a.litres);
  }, [transactions, enriched]);

  // Per-project roll-up
  const perProject = useMemo(() => {
    const rows: Record<
      string,
      { id: string; name: string; site: string | null; litres: number; deliveries: number; ftcClaim: number; machineCount: Set<string> }
    > = {};
    transactions.forEach((t) => {
      const placa = (t.placa || "").toString().trim();
      if (!placa) return;
      const item = enriched.placaToItem[placa];
      if (!item) return;
      const projId = enriched.itemToProject[item.id];
      if (!projId) return;
      const proj = enriched.projectById[projId];
      if (!proj) return;
      if (!rows[projId]) {
        rows[projId] = {
          id: projId,
          name: proj.name,
          site: proj.site_address,
          litres: 0,
          deliveries: 0,
          ftcClaim: 0,
          machineCount: new Set(),
        };
      }
      const litres = t.cantidad || 0;
      rows[projId].litres += litres;
      rows[projId].deliveries += 1;
      rows[projId].machineCount.add(item.id);
      const ftc = item.ftc_rate_id ? enriched.ftcById[item.ftc_rate_id] : null;
      if (ftc) rows[projId].ftcClaim += litres * Number(ftc.rate_per_litre);
    });
    return Object.values(rows)
      .map((r) => ({ ...r, machines: r.machineCount.size }))
      .sort((a, b) => b.litres - a.litres);
  }, [transactions, enriched]);

  // A vs B comparator state — defaults to top two of each
  const [machA, setMachA] = useState<string>("");
  const [machB, setMachB] = useState<string>("");
  const [projA, setProjA] = useState<string>("");
  const [projB, setProjB] = useState<string>("");
  useEffect(() => {
    if (!machA && perMachine[0]) setMachA(perMachine[0].id);
    if (!machB && perMachine[1]) setMachB(perMachine[1].id);
  }, [perMachine, machA, machB]);
  useEffect(() => {
    if (!projA && perProject[0]) setProjA(perProject[0].id);
    if (!projB && perProject[1]) setProjB(perProject[1].id);
  }, [perProject, projA, projB]);

  const machineMaxLitres = perMachine[0]?.litres || 1;
  const projectMaxLitres = perProject[0]?.litres || 1;

  const aMach = perMachine.find((m) => m.id === machA);
  const bMach = perMachine.find((m) => m.id === machB);
  const aProj = perProject.find((p) => p.id === projA);
  const bProj = perProject.find((p) => p.id === projB);

  const fmt$ = (n: number) =>
    `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

  const totalLitres = perMachine.reduce((s, m) => s + m.litres, 0);
  const totalFtc = perMachine.reduce((s, m) => s + m.ftcClaim, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={sectionTitle}>Analytics</h2>
          <p style={{ ...muted(12), margin: "4px 0 0" }}>
            Machine-vs-machine and project-vs-project comparisons for {periodLabel.toLowerCase()}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <div style={labelStyle}>Tracked litres</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.text }}>
              {fmtL(totalLitres)}
            </div>
          </div>
          <div>
            <div style={labelStyle}>FTC claimable</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.accent }}>
              {fmt$(totalFtc)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Machinery leaderboard ── */}
      <div style={card}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Machinery Leaderboard</div>
        <div style={{ ...muted(11), marginBottom: 14 }}>Ranked by fuel volume in this period.</div>
        {perMachine.length === 0 ? (
          <p style={muted(13)}>No machinery deliveries in this period.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {perMachine.slice(0, 10).map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                <span style={{ color: T.muted, width: 22, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <span
                  aria-hidden
                  style={{
                    width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: m.colour || T.muted,
                    border: `1px solid ${T.border}`,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name}
                  </div>
                  <div style={{ ...muted(10) }}>
                    {m.placa} · {m.type} · {m.projectName}
                  </div>
                </div>
                <div style={{ width: 140, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ width: `${(m.litres / machineMaxLitres) * 100}%`, height: "100%", background: T.accent }} />
                </div>
                <span style={{ minWidth: 80, textAlign: "right", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmtL(m.litres)}
                </span>
                <span style={{ minWidth: 80, textAlign: "right", color: T.accent, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmt$(m.ftcClaim)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Machine vs machine compare ── */}
      <div style={card}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Machinery vs Machinery</div>
        <div style={{ ...muted(11), marginBottom: 14 }}>
          Pick any two pieces of plant to benchmark fuel volume, deliveries and FTC.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <select value={machA} onChange={(e) => setMachA(e.target.value)} style={inputStyle}>
            {perMachine.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select value={machB} onChange={(e) => setMachB(e.target.value)} style={inputStyle}>
            {perMachine.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        {aMach && bMach ? (
          <CompareGrid
            a={{ label: aMach.name, sublabel: `${aMach.placa} · ${aMach.type}`,
                 stats: [
                   { label: "Litres",         num: aMach.litres,                                              fmt: fmtL,  higherIsBetter: true },
                   { label: "Deliveries",     num: aMach.deliveries,                                          fmt: (n) => n.toString(), higherIsBetter: true },
                   { label: "Avg / Delivery", num: aMach.deliveries ? aMach.litres / aMach.deliveries : 0,    fmt: fmtL,  higherIsBetter: true },
                   { label: "FTC Claim",      num: aMach.ftcClaim,                                            fmt: fmt$,  higherIsBetter: true, accent: true },
                 ] }}
            b={{ label: bMach.name, sublabel: `${bMach.placa} · ${bMach.type}`,
                 stats: [
                   { label: "Litres",         num: bMach.litres,                                              fmt: fmtL,  higherIsBetter: true },
                   { label: "Deliveries",     num: bMach.deliveries,                                          fmt: (n) => n.toString(), higherIsBetter: true },
                   { label: "Avg / Delivery", num: bMach.deliveries ? bMach.litres / bMach.deliveries : 0,    fmt: fmtL,  higherIsBetter: true },
                   { label: "FTC Claim",      num: bMach.ftcClaim,                                            fmt: fmt$,  higherIsBetter: true, accent: true },
                 ] }}
          />
        ) : (
          <p style={muted(13)}>Need at least two machines with deliveries to compare.</p>
        )}
      </div>

      {/* ── Project leaderboard ── */}
      <div style={card}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Project Leaderboard</div>
        <div style={{ ...muted(11), marginBottom: 14 }}>Fuel attributed to each active project.</div>
        {perProject.length === 0 ? (
          <p style={muted(13)}>No project-attributed deliveries in this period.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {perProject.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                <span style={{ color: T.muted, width: 22, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div style={{ ...muted(10) }}>
                    {p.site || "—"} · {p.machines} machine{p.machines === 1 ? "" : "s"} · {p.deliveries} dlv
                  </div>
                </div>
                <div style={{ width: 140, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ width: `${(p.litres / projectMaxLitres) * 100}%`, height: "100%", background: T.accent }} />
                </div>
                <span style={{ minWidth: 80, textAlign: "right", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmtL(p.litres)}
                </span>
                <span style={{ minWidth: 80, textAlign: "right", color: T.accent, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmt$(p.ftcClaim)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Project vs project compare ── */}
      <div style={card}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Project vs Project</div>
        <div style={{ ...muted(11), marginBottom: 14 }}>
          Benchmark sites against each other on fuel intensity and tax credits.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <select value={projA} onChange={(e) => setProjA(e.target.value)} style={inputStyle}>
            {perProject.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select value={projB} onChange={(e) => setProjB(e.target.value)} style={inputStyle}>
            {perProject.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {aProj && bProj ? (
          <CompareGrid
            a={{ label: aProj.name, sublabel: aProj.site || "—",
                 stats: [
                   { label: "Litres",         num: aProj.litres,                                              fmt: fmtL,  higherIsBetter: true },
                   { label: "Deliveries",     num: aProj.deliveries,                                          fmt: (n) => n.toString(), higherIsBetter: true },
                   { label: "Avg / Delivery", num: aProj.deliveries ? aProj.litres / aProj.deliveries : 0,    fmt: fmtL,  higherIsBetter: true },
                   { label: "Active Plant",   num: aProj.machines,                                            fmt: (n) => n.toString(), higherIsBetter: true },
                   { label: "FTC Claim",      num: aProj.ftcClaim,                                            fmt: fmt$,  higherIsBetter: true, accent: true },
                 ] }}
            b={{ label: bProj.name, sublabel: bProj.site || "—",
                 stats: [
                   { label: "Litres",         num: bProj.litres,                                              fmt: fmtL,  higherIsBetter: true },
                   { label: "Deliveries",     num: bProj.deliveries,                                          fmt: (n) => n.toString(), higherIsBetter: true },
                   { label: "Avg / Delivery", num: bProj.deliveries ? bProj.litres / bProj.deliveries : 0,    fmt: fmtL,  higherIsBetter: true },
                   { label: "Active Plant",   num: bProj.machines,                                            fmt: (n) => n.toString(), higherIsBetter: true },
                   { label: "FTC Claim",      num: bProj.ftcClaim,                                            fmt: fmt$,  higherIsBetter: true, accent: true },
                 ] }}
          />
        ) : (
          <p style={muted(13)}>Need at least two projects with deliveries to compare.</p>
        )}
      </div>
    </div>
  );
}

type CompareStat = {
  label: string;
  num: number;
  fmt: (n: number) => string;
  higherIsBetter?: boolean;
  accent?: boolean;
};
type CompareSide = { label: string; sublabel: string; stats: CompareStat[] };

function CompareGrid({ a, b }: { a: CompareSide; b: CompareSide }) {
  // Pre-compute per-row winners + deltas
  const rows = a.stats.map((sa, i) => {
    const sb = b.stats[i];
    const delta = sa.num - sb.num;
    const base = Math.max(Math.abs(sa.num), Math.abs(sb.num));
    const pct = base > 0 ? (Math.abs(delta) / base) * 100 : 0;
    const aBetter = sa.higherIsBetter ? sa.num > sb.num : sa.num < sb.num;
    const bBetter = sa.higherIsBetter ? sb.num > sa.num : sb.num < sa.num;
    return { sa, sb, delta, pct, aBetter, bBetter, tied: sa.num === sb.num };
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {[
        { side: a, key: "a" as const },
        { side: b, key: "b" as const },
      ].map(({ side, key }) => (
        <div key={key} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "12px 14px", background: T.bg }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.sansHead, marginBottom: 2 }}>
            {side.label}
          </div>
          <div style={{ ...muted(10), marginBottom: 12 }}>{side.sublabel}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {side.stats.map((s, i) => {
              const r = rows[i];
              const isWinner = key === "a" ? r.aBetter : r.bBetter;
              const showDelta = !r.tied && r.pct >= 0.5;
              const sign = key === "a" ? (r.delta > 0 ? "+" : r.delta < 0 ? "−" : "") : (r.delta < 0 ? "+" : r.delta > 0 ? "−" : "");
              const chipBg   = isWinner ? "rgba(16,185,129,0.15)" : "rgba(232,70,30,0.12)";
              const chipText = isWinner ? "#10B981" : "#E8461E";
              return (
                <div key={s.label} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "baseline", gap: 8 }}>
                  <div>
                    <div style={labelStyle}>{s.label}</div>
                    <div style={{
                      fontSize: 18, fontWeight: 700,
                      color: s.accent ? T.accent : T.text,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {s.fmt(s.num)}
                    </div>
                  </div>
                  {showDelta && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                      padding: "3px 6px", borderRadius: 10,
                      background: chipBg, color: chipText,
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}>
                      {sign}{r.pct.toFixed(r.pct < 10 ? 1 : 0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
