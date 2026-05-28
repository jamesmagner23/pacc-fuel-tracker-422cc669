import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { format, parseISO, startOfMonth, startOfQuarter, subMonths, endOfMonth, addDays, startOfWeek, subDays } from "date-fns";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";

import { supabase } from "@/integrations/supabase/client";
import { PACCLogo } from "@/components/PACCLogo";
import { TruckMap } from "@/components/TruckMap";
import { logActivity } from "@/hooks/useActivityLog";
import { logDemoEvent } from "@/lib/demoAnalytics";
import { useDemo } from "@/hooks/useDemo";
import { getDemoData, DEMO_CLIENT_ACCOUNTS } from "@/data/demoData";
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ComposedChart, Area, Line, CartesianGrid } from "recharts";
import { PlantBoard } from "@/components/customer/PlantBoard";
import { usePlantItems } from "@/hooks/usePlantItems";
import { PlantDetailsModal } from "@/components/customer/PlantDetailsModal";
import { useProjects, useProjectAssignments } from "@/hooks/useProjects";
import { groupAssignmentsByPlantItem, projectForItemAt } from "@/lib/projectAttribution";
import { useFtcRates, type FtcRate } from "@/hooks/useFtcRates";
import { AccountModal } from "@/components/customer/AccountModal";
import { useClientProfile } from "@/hooks/useClientProfile";
import { Filter, Droplet, DollarSign, Truck, Gauge, Receipt, MapPin, Download, HelpCircle, Mail } from "lucide-react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  usePortalFilters,
  filterTransactions,
  type PortalFilters,
} from "@/hooks/usePortalFilters";
import { PortalFilterBar } from "@/components/customer/PortalFilterBar";
import { usePlantTags, usePlantItemTagLinks } from "@/hooks/usePlantTags";
import { useTransactionOverrides } from "@/hooks/useTransactionOverrides";
import { WelcomeModal } from "@/components/customer/WelcomeModal";
import { PortalLayout } from "@/components/portal/PortalLayout";

import { KPISparklineCard } from "@/components/KPISparklineCard";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ─── Theme tokens — light "showcase email" palette ──────────────────
// Mutable holder. Properties get re-assigned by applyPortalTheme() below
// whenever the user toggles light/dark, so all module-scoped style
// objects (card, labelStyle, ...) that reference T see the new palette.
const T = {
  bg: "#EFE9DC",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#EDE3D2",
  borderSubtle: "#F1E8D8",
  accent: "#C8F26A",
  accentHover: "#B6E254",
  // Chart fill color — deliberately NOT the lime accent. Lime is reserved
  // for buttons/borders; charts use a darker, more readable green on cream.
  chart: "#3F6B36",
  text: "#0E1F10",
  textSecondary: "#2A4A2E",
  muted: "#8B8773",
  sansHead: "'Inter', system-ui, sans-serif",
  sansBody: "'Inter', system-ui, sans-serif",
  badgePending: "#8B8773",
  badgeConfirmed: "#C8F26A",
  badgeCompleted: "#3F6B36",
};

/**
 * Re-write T's keys (and rebuild the precomputed style objects) to match
 * the active portal theme. Called once before each render.
 *
 * IMPORTANT: React freezes objects passed as `style` props in development.
 * We must therefore *replace* T and every shared style holder with a brand
 * new literal each call — never mutate the previous object (`Object.assign`
 * on a frozen target throws "Cannot assign to read only property").
 */
function applyPortalTheme() {
  // Locked to the PACC admin palette so the client portal matches the
  // operations dashboard exactly (off-white surface, dark-green text,
  // lime accent). The previous light/dark toggle has been removed.
  T.bg = "#F4F5F1";
  T.surface = "#FFFFFF";
  T.surfaceRaised = "#FFFFFF";
  T.border = "#E5E7DF";
  T.borderSubtle = "#EFEFE9";
  T.accent = "#C8F26A";
  T.accentHover = "#B6E254";
  T.chart = "#2A6A2E";
  T.text = "#0E1F10";
  T.textSecondary = "#3A4A3C";
  T.muted = "#6B7268";
  T.badgePending = "#8B8773";
  T.badgeConfirmed = "#C8F26A";
  T.badgeCompleted = "#2A6A2E";

  // 2. Build *fresh* style literals from scratch. We do not spread the
  //    previous (potentially frozen) objects — every property is rewritten.
  card = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "16px 18px",
  };
  ghostBtn = {
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
  inputStyle = {
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
  labelStyle = {
    fontSize: 10,
    fontFamily: T.sansHead,
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: T.muted,
    display: "block",
    marginBottom: 6,
  };
  sectionTitle = {
    fontSize: 18,
    fontFamily: T.sansHead,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: T.text,
    margin: 0,
  };
}

const tabs = [
  "Overview",
  "Deliveries",
  "Fleet",
  "Projects",
  "Reports",
  "Profile",
] as const;
type Tab = (typeof tabs)[number];

// Reports group: Emissions + Fuel Tax Credit
const reportSubtabs = ["Emissions", "Fuel Tax Credit"] as const;
type ReportSubtab = (typeof reportSubtabs)[number];

// Day / Week / Month / Custom period toggle for the customer portal.
type PortalPeriod = "day" | "week" | "month" | "all" | "custom";
const PERIOD_DAYS: Record<Exclude<PortalPeriod, "custom">, number | null> = {
  day: 1, week: 7, month: 30, all: null,
};
const PERIOD_LABELS: Record<PortalPeriod, string> = {
  day: "Daily", week: "Weekly", month: "Monthly", all: "All Time", custom: "Custom",
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
          .select("company_name, speedsol_names, logo_url, brand_accent, branding_enabled")
          .eq("id", data.client_account_id)
          .single();
        if (ca) {
          companyName = ca.company_name;
          speedsolNames = ca.speedsol_names || [];
          (data as any).logo_url = ca.logo_url;
          (data as any).brand_accent = ca.brand_accent;
          (data as any).branding_enabled = ca.branding_enabled;
        }
      }
      // Fallback: if no company is linked yet, derive a friendlier label
      // from the user's email (e.g. "ops@ironside.com" → "Ironside") so
      // the portal never reads "YOUR ACCOUNT" / "YA" to a real customer.
      if (companyName === "Your Account" && user.email) {
        const local = user.email.split("@")[0] || "";
        const domain = (user.email.split("@")[1] || "").split(".")[0] || "";
        const guess = (domain || local).replace(/[._-]+/g, " ").trim();
        if (guess) {
          companyName = guess
            .split(/\s+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
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
let card: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: "16px 18px",
};

let ghostBtn: React.CSSProperties = {
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

let inputStyle: React.CSSProperties = {
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

let labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: T.sansHead,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: T.muted,
  display: "block",
  marginBottom: 6,
};

let sectionTitle: React.CSSProperties = {
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
        e.currentTarget.style.color = T.text;
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
export default function CustomerPortal({ forcedTab }: { forcedTab?: Tab | "Help" } = {}) {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const initialTab: Tab | "Help" = forcedTab
    ? forcedTab
    : (tabs as readonly string[]).includes(tabParam || "")
      ? (tabParam as Tab)
      : "Overview";
  const [activeTab, setActiveTabState] = useState<Tab | "Help">(initialTab);
  // When the URL-driven forcedTab changes (sub-route nav), follow it.
  useEffect(() => {
    if (forcedTab && forcedTab !== activeTab) {
      setActiveTabState(forcedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedTab]);
  // Legacy ?tab= support — only honoured when no forcedTab is supplied.
  useEffect(() => {
    if (forcedTab) return;
    if (tabParam !== activeTab) {
      const next = new URLSearchParams(params);
      next.set("tab", activeTab);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  useEffect(() => {
    if (forcedTab) return;
    if (tabParam && (tabs as readonly string[]).includes(tabParam) && tabParam !== activeTab) {
      setActiveTabState(tabParam as Tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  const setActiveTab = setActiveTabState as (t: Tab) => void;
  const [reportsSubtab, setReportsSubtab] = useState<ReportSubtab>("Emissions");
  const [period, setPeriod] = useState<PortalPeriod>("month");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const isDemo = useDemo();
  const demoSuffix = isDemo ? `?${params.toString()}` : "";

  const { data: profile } = useCustomerProfile();
  const speedsolNames = profile?.speedsolNames || [];
  const companyName = profile?.companyName || "Your Account";
  const clientAccountId = profile?.client_account_id || null;
  const userEmail = (profile as any)?.email || "";

  // Customer branding: only kicks in when admin has uploaded + enabled it.
  const brandLogoUrl: string | null = (profile as any)?.logo_url || null;
  const brandingEnabled: boolean = !!(profile as any)?.branding_enabled;
  const showCustomerBrand = !isDemo && brandingEnabled && !!brandLogoUrl;
  // Portal palette is now locked to the admin PACC palette (lime / dark-green
  // / off-white) regardless of customer branding. The sidebar logo is the
  // only place the customer brand still surfaces.
  applyPortalTheme();
  const [accountOpen, setAccountOpen] = useState(false);

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
    if (period === "custom") {
      const { from, to } = customRange;
      if (!from && !to) return transactions;
      const fromStr = from ? format(from, "yyyy-MM-dd") : "0000-01-01";
      const toStr = to ? format(to, "yyyy-MM-dd") : "9999-12-31";
      return transactions.filter((t: any) => {
        const d = t.date || "";
        return d >= fromStr && d <= toStr;
      });
    }
    const days = PERIOD_DAYS[period];
    if (days == null) return transactions;
    const cutoff = subDays(new Date(), days);
    cutoff.setHours(0, 0, 0, 0);
    const cutoffStr = format(cutoff, "yyyy-MM-dd");
    return transactions.filter((t: any) => (t.date || "") >= cutoffStr);
  }, [transactions, period, customRange]);

  // First-paint guard: if the default "This Month" window is empty but the
  // customer DOES have deliveries on file, auto-fall back to "All Time" so
  // the KPI tiles never greet the user with "0 L". Only fires once per
  // session and only from the default "month" position.
  const autoFellBackRef = useRef(false);
  useEffect(() => {
    if (autoFellBackRef.current) return;
    if (isLoading) return;
    if (period !== "month") return;
    if (transactions.length === 0) return;
    if (periodTransactions.length > 0) return;
    autoFellBackRef.current = true;
    setPeriod("all");
  }, [isLoading, period, transactions.length, periodTransactions.length]);

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
      section: activeTab as Tab,
    });
  }, [isDemo, activeTab]);

  const body = (
    <>
      {/* Day / Week / Month period toggle — applies to time-series tabs.
          Overview embeds its own period selector inside the dashboard. */}
      {(activeTab === "Deliveries" ||
          activeTab === "Fleet" ||
          (activeTab === "Reports" && reportsSubtab === "Fuel Tax Credit")) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div className="flex items-center gap-3 flex-wrap">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  padding: 3,
                  borderRadius: 999,
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                }}
              >
                {(["day", "week", "month", "all"] as PortalPeriod[]).map((p) => {
                  const active = period === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      style={{
                        padding: "6px 14px",
                        fontSize: 11,
                        fontFamily: T.sansHead,
                        fontWeight: active ? 600 : 500,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: active ? T.text : T.textSecondary,
                        background: active ? T.accent : "transparent",
                        border: "none",
                        borderRadius: 999,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 160ms ease",
                      }}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  );
                })}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: T.textSecondary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <strong style={{ color: T.text, fontWeight: 600 }}>
                  {periodTransactions.length.toLocaleString()}
                </strong>{" "}
                deliveries
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full hover:opacity-90 transition-opacity"
                    style={{
                      height: 36,
                      padding: "0 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: "transparent",
                      color: T.text,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Statement
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      const header = ["Date", "Site", "Plant", "Rego", "Litres", "Spend"];
                      const rows = filteredTransactions.map((t: any) => [
                        t.date || "",
                        t.estacion || t.ciudad || t.nombre_cliente1 || "",
                        t.identificador_cliente1 || "",
                        t.placa || "",
                        (t.cantidad || 0).toFixed(2),
                        (t.dinero_total || 0).toFixed(2),
                      ]);
                      const safeName = (companyName || "deliveries").replace(/[^A-Za-z0-9]+/g, "-");
                      const safePeriod = (PERIOD_LABELS[period] || "current").replace(/\s+/g, "-");
                      downloadCSV([header, ...rows], `${safeName}-statement-${safePeriod}.csv`);
                    }}
                  >
                    Statement (this period)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const header = ["Date", "Site", "Plant", "Rego", "Litres", "Docket"];
                      const rows = filteredTransactions.map((t: any) => [
                        t.date || "",
                        t.estacion || t.ciudad || t.nombre_cliente1 || "",
                        t.identificador_cliente1 || "",
                        t.placa || "",
                        (t.cantidad || 0).toFixed(2),
                        t.id ?? "",
                      ]);
                      const safeName = (companyName || "deliveries").replace(/[^A-Za-z0-9]+/g, "-");
                      const safePeriod = (PERIOD_LABELS[period] || "current").replace(/\s+/g, "-");
                      downloadCSV([header, ...rows], `${safeName}-deliveries-${safePeriod}.csv`);
                    }}
                  >
                    Deliveries CSV (this period)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setReportsSubtab("Fuel Tax Credit"); setActiveTab("Reports"); }}>
                    Tax-credits report (YTD)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    Custom date range… (coming soon)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}


        {isLoading && activeTab !== "Fleet" ? (
          <p style={muted(13)}>Loading...</p>
        ) : (
          <>
            {activeTab === "Overview" && (
              <OverviewTab
                transactions={filteredTransactions}
                allTransactions={transactions}
                period={period}
                setPeriod={setPeriod}
                customRange={customRange}
                setCustomRange={setCustomRange}
                demoSuffix={demoSuffix}
                speedsolNames={speedsolNames}
                isDemo={isDemo}
                plantItems={plantItemsAll}
                onOpenFtcReport={() => {
                  setReportsSubtab("Fuel Tax Credit");
                  setActiveTab("Reports");
                }}
                onOpenDeliveries={() => setActiveTab("Deliveries")}
                onOpenFuelVolume={() => {
                  setReportsSubtab("Emissions");
                  setActiveTab("Reports");
                }}
                onOpenSites={() => {
                  setActiveTab("Projects");
                }}
                periodLabel={PERIOD_LABELS[period]}
                companyName={companyName}
                portalFilters={portalFilters}
                availableTypes={availableTypes}
                availableProjects={projectsAll.map((p) => ({ id: p.id, name: p.name }))}
                activeSitesCount={projectsAll.filter((p: any) => (p.status || "active") === "active").length}
                availableTags={plantTagsAll.map((t) => ({ id: t.id, name: t.name }))}
                placaToProjectName={(() => {
                  const projectName: Record<string, string> = {};
                  projectsAll.forEach((p: any) => { projectName[p.id] = p.name; });
                  const out: Record<string, string> = {};
                  Object.entries(lookups.placaToProject).forEach(([placa, pid]) => {
                    if (projectName[pid as string]) out[placa] = projectName[pid as string];
                  });
                  return out;
                })()}
              />
            )}
            {activeTab === "Deliveries" && (
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
            {activeTab === "Fleet" && (
              <PlantTab clientAccountId={clientAccountId} transactions={filteredTransactions} />
            )}
            {activeTab === "Projects" && (
              <ProjectsTab
                transactions={periodTransactions}
                allTransactions={transactions}
                clientAccountId={clientAccountId}
              />
            )}
            {activeTab === "Reports" && (
              <>
                <SubtabBar
                  options={reportSubtabs as unknown as string[]}
                  active={reportsSubtab}
                  onChange={(s) => setReportsSubtab(s as ReportSubtab)}
                />
                {reportsSubtab === "Emissions" && (
                  <EmissionsTab
                    transactions={transactions}
                    companyName={companyName}
                    placaToProjectName={(() => {
                      const projectName: Record<string, string> = {};
                      projectsAll.forEach((p: any) => { projectName[p.id] = p.name; });
                      const out: Record<string, string> = {};
                      Object.entries(lookups.placaToProject).forEach(([placa, pid]) => {
                        if (projectName[pid as string]) out[placa] = projectName[pid as string];
                      });
                      return out;
                    })()}
                  />
                )}
                {reportsSubtab === "Fuel Tax Credit" && (
                  <FtcReportTab
                    transactions={filteredTransactions}
                    plantItems={plantItemsAll}
                    companyName={companyName}
                    periodLabel={PERIOD_LABELS[period]}
                  />
                )}
              </>
            )}
            {activeTab === "Profile" && (
              <ProfileTab
                clientAccountId={clientAccountId}
                companyName={companyName}
                userEmail={userEmail}
                onOpenEdit={() => setAccountOpen(true)}
              />
            )}
            {activeTab === "Help" && (
              <div className="bg-card border border-border rounded-[14px] p-6 max-w-2xl">
                <div className="flex items-start gap-3">
                  <div className="inline-flex items-center justify-center shrink-0"
                       style={{ width: 40, height: 40, borderRadius: 12, background: "#EAEEFC", color: "#2B3D8E" }}>
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Need a hand?</h2>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Dispatch is available Monday–Friday, 7am–5pm AEST.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href="mailto:fuel@paccvictoria.com"
                         className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium bg-foreground text-background hover:opacity-90">
                        <Mail className="w-3.5 h-3.5" /> fuel@paccvictoria.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        clientAccountId={clientAccountId}
        companyName={companyName}
        userEmail={userEmail}
      />
    </>
  );

  // In demo mode the admin Layout already provides the sidebar/topbar chrome,
  // so we render the body bare. In real client mode we wrap with PortalLayout.
  if (isDemo) {
    return <div className="max-w-[1400px] mx-auto">{body}</div>;
  }

  return (
    <PortalLayout
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as Tab)}
      brandLogoUrl={showCustomerBrand ? brandLogoUrl : null}
      brandCaption={companyName}
      customerName={isDemo ? "Demo Customer" : companyName}
      accountNumber={clientAccountId ? `Account #C${clientAccountId}` : null}
      isDemo={isDemo}
    >
      <WelcomeModal />
      {body}
    </PortalLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 01 OVERVIEW (preserved — no pricing, simplified to spec rules)
// ═══════════════════════════════════════════════════════════════════════
function ProfileTab({
  clientAccountId,
  companyName,
  userEmail,
  onOpenEdit,
}: {
  clientAccountId: number | null;
  companyName: string;
  userEmail: string;
  onOpenEdit: () => void;
}) {
  const { data: profile, isLoading } = useClientProfile(clientAccountId);

  const billingLine = [
    profile?.billing_address_line1,
    profile?.billing_address_line2,
    [profile?.billing_suburb, profile?.billing_state, profile?.billing_postcode].filter(Boolean).join(" "),
    profile?.billing_country,
  ].filter(Boolean).join(", ");

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--surface-border, rgba(255,255,255,0.06))" }}>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground, #8B8773)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--foreground, #ECE4D2)", textAlign: "right" }}>{value || "—"}</span>
    </div>
  );

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: "var(--surface, rgba(255,255,255,0.04))", border: "1px solid var(--surface-border, rgba(255,255,255,0.08))", borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--foreground, #ECE4D2)", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--foreground, #ECE4D2)" }}>Company profile</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground, #8B8773)", margin: "4px 0 0" }}>Keep your company and contact details up to date.</p>
        </div>
        <button onClick={onOpenEdit} style={{ background: "var(--accent, #C8F26A)", color: "#0E1F10", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit profile</button>
      </div>

      {isLoading ? (
        <div style={{ color: "var(--muted-foreground, #8B8773)", fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <Card title="Company">
            <Row label="Trading name" value={companyName} />
            <Row label="Legal name" value={profile?.legal_business_name} />
            <Row label="ABN" value={profile?.abn} />
            <Row label="Website" value={profile?.website} />
            <Row label="Login email" value={userEmail} />
          </Card>
          <Card title="Billing address">
            <Row label="Address" value={billingLine} />
          </Card>
          <Card title="Primary contact">
            <Row label="Name" value={profile?.primary_contact_name} />
            <Row label="Email" value={profile?.primary_contact_email} />
            <Row label="Phone" value={profile?.primary_contact_phone} />
          </Card>
          <Card title="Operations contact">
            <Row label="Name" value={profile?.ops_contact_name} />
            <Row label="Email" value={profile?.ops_contact_email} />
            <Row label="Phone" value={profile?.ops_contact_phone} />
          </Card>
          <Card title="Accounts contact">
            <Row label="Name" value={profile?.accounts_contact_name} />
            <Row label="Email" value={profile?.accounts_contact_email} />
            <Row label="Phone" value={profile?.accounts_contact_phone} />
          </Card>
          <Card title="Site contact">
            <Row label="Name" value={profile?.site_contact_name} />
            <Row label="Email" value={profile?.site_contact_email} />
            <Row label="Phone" value={profile?.site_contact_phone} />
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Subtab strip (used for Fleet + Reports groups) ──────────────────
function SubtabBar({
  options,
  active,
  onChange,
}: {
  options: string[];
  active: string;
  onChange: (next: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 0,
        marginBottom: 16,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 999,
        padding: 3,
      }}
    >
      {options.map((opt) => {
        const on = opt === active;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "7px 14px",
              fontSize: 11,
              fontFamily: T.sansHead,
              fontWeight: on ? 700 : 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: on ? T.text : T.textSecondary,
              background: on ? T.accent : "transparent",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Hero "Litres Used" — refined two-column visual ──────────────────
function HeroLitres({
  totalLitres,
  deliveries,
  sites,
  transactions,
}: {
  totalLitres: number;
  deliveries: number;
  sites: number;
  transactions: any[];
}) {
  // Compact daily series for sparkline (last ~30 days of activity)
  const series = useMemo(() => {
    const byDay = new Map<string, number>();
    transactions.forEach((t) => {
      const k = (t.date || "").slice(0, 10);
      if (!k) return;
      byDay.set(k, (byDay.get(k) || 0) + (t.cantidad || 0));
    });
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([day, litres]) => ({ day, litres }));
  }, [transactions]);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 14,
        border: `1px solid ${T.accent}40`,
        background: `linear-gradient(135deg, ${T.accent}1f 0%, ${T.accent}08 45%, ${T.surface} 100%)`,
        padding: "22px 22px 18px",
      }}
    >
      {/* Decorative accent glyph */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -40, right: -40,
          width: 180, height: 180,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${T.accent}26 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "end" }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 8, color: T.textSecondary }}>Litres Delivered</div>
          <div
            style={{
              fontSize: "clamp(44px, 12vw, 76px)",
              lineHeight: 0.95,
              fontFamily: T.sansHead,
              fontWeight: 700,
              color: T.text,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.035em",
              display: "flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            {Math.round(totalLitres).toLocaleString()}
            <span style={{ fontSize: "0.36em", fontWeight: 500, color: T.text, letterSpacing: "-0.01em" }}>L</span>
          </div>
          <div style={{ ...muted(11), marginTop: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <strong style={{ color: T.text, fontWeight: 600 }}>{deliveries.toLocaleString()}</strong> deliveries
            <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
            <strong style={{ color: T.text, fontWeight: 600 }}>{sites}</strong> {sites === 1 ? "site" : "sites"}
          </div>
        </div>

        {series.length > 1 && (
          <div style={{ width: 140, height: 56, opacity: 0.85 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="litres" fill={T.chart} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fuel Tax Credit report (Reports sub-tab) ────────────────────────
function FtcReportTab({
  transactions,
  plantItems,
  companyName,
  periodLabel,
}: {
  transactions: any[];
  plantItems: any[];
  companyName: string;
  periodLabel: string;
}) {
  const { data: rates = [] } = useFtcRates();

  // Resolve placa → plant_item → ftc_rate
  const placaToItem = useMemo(() => {
    const m = new Map<string, any>();
    (plantItems || []).forEach((pi: any) => {
      if (pi?.placa) m.set(String(pi.placa), pi);
    });
    return m;
  }, [plantItems]);

  const rateById = useMemo(() => {
    const m = new Map<string, FtcRate>();
    (rates || []).forEach((r: FtcRate) => m.set(r.id, r));
    return m;
  }, [rates]);

  // Fallback "off-road" rate for unmapped diesel (most generous, standard for plant)
  const fallbackRate = useMemo(
    () => rates.find((r) => /off-road|machinery|plant/i.test(r.equipment_type)) || rates[0],
    [rates]
  );

  type Row = {
    placa: string;
    plantName: string;
    category: string;
    rate: number;
    litres: number;
    credit: number;
    mapped: boolean;
  };

  const rows: Row[] = useMemo(() => {
    const byKey = new Map<string, Row>();
    transactions.forEach((t) => {
      const placa = (t.placa || "").toString().trim() || "UNASSIGNED";
      const item = placaToItem.get(placa);
      const rate = item?.ftc_rate_id ? rateById.get(item.ftc_rate_id) : fallbackRate;
      const category = rate?.equipment_type || "Unmapped (no FTC claim)";
      const ratePerL = Number(rate?.rate_per_litre || 0);
      const litres = Number(t.cantidad || 0);
      const key = `${placa}::${category}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.litres += litres;
        existing.credit += litres * ratePerL;
      } else {
        byKey.set(key, {
          placa,
          plantName: item?.name || (placa === "UNASSIGNED" ? "Unassigned" : placa),
          category,
          rate: ratePerL,
          litres,
          credit: litres * ratePerL,
          mapped: !!item,
        });
      }
    });
    return Array.from(byKey.values()).sort((a, b) => b.credit - a.credit);
  }, [transactions, placaToItem, rateById, fallbackRate]);

  const totals = useMemo(() => {
    const totalLitres = rows.reduce((s, r) => s + r.litres, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    const byCategory = new Map<string, { litres: number; credit: number; rate: number }>();
    rows.forEach((r) => {
      const cur = byCategory.get(r.category) || { litres: 0, credit: 0, rate: r.rate };
      cur.litres += r.litres;
      cur.credit += r.credit;
      byCategory.set(r.category, cur);
    });
    return { totalLitres, totalCredit, byCategory: Array.from(byCategory.entries()) };
  }, [rows]);

  const exportCSV = () => {
    const header = ["Plant", "Plate / ID", "FTC Category", "Rate ($/L)", "Litres", "Fuel Tax Credit ($)"];
    const body = rows.map((r) => [
      r.plantName,
      r.placa,
      r.category,
      r.rate.toFixed(4),
      Math.round(r.litres),
      r.credit.toFixed(2),
    ]);
    body.push(["", "", "", "TOTAL", Math.round(totals.totalLitres), totals.totalCredit.toFixed(2)]);
    const fname = `FTC-Report_${companyName.replace(/\s+/g, "-")}_${periodLabel.replace(/\s+/g, "-")}.csv`;
    downloadCSV([header, ...body], fname);
    logActivity("export", { type: "ftc-csv", rows: rows.length, period: periodLabel });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero KPIs */}
      <div
        style={{
          ...card,
          background: `linear-gradient(135deg, ${T.accent}1a, ${T.accent}05)`,
          borderColor: `${T.accent}55`,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Estimated Fuel Tax Credit</div>
            <div
              style={{
                fontSize: "clamp(34px, 10vw, 56px)",
                fontFamily: T.sansHead,
                fontWeight: 700,
                color: T.text,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              ${Math.round(totals.totalCredit).toLocaleString()}
            </div>
            <div style={{ ...muted(12), marginTop: 6 }}>
              {Math.round(totals.totalLitres).toLocaleString()} L · {periodLabel}
            </div>
          </div>
          <button
            onClick={exportCSV}
            style={{
              background: T.accent,
              color: T.text,
              border: "none",
              borderRadius: 999,
              padding: "10px 18px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Per-category breakdown */}
      <div style={card}>
        <div style={{ ...labelStyle, marginBottom: 10 }}>By Category</div>
        <div style={{ display: "grid", gap: 8 }}>
          {totals.byCategory.map(([cat, v]) => (
            <div
              key={cat}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 8,
                background: T.surface,
                border: `1px solid ${T.border}`,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{cat}</div>
                <div style={{ ...muted(11), marginTop: 2 }}>
                  {Math.round(v.litres).toLocaleString()} L × ${v.rate.toFixed(3)}/L
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontVariantNumeric: "tabular-nums" }}>
                ${Math.round(v.credit).toLocaleString()}
              </div>
            </div>
          ))}
          {totals.byCategory.length === 0 && (
            <p style={muted(12)}>No fuel usage in this period.</p>
          )}
        </div>
      </div>

      {/* Per-plant detail table */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={labelStyle}>Per-Plant Detail</div>
          <span style={{ ...muted(11), letterSpacing: "0.06em", textTransform: "uppercase" }}>{rows.length} plant items</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: T.textSecondary }}>
                <th style={ftcTh}>Plant</th>
                <th style={ftcTh}>Plate</th>
                <th style={ftcTh}>Category</th>
                <th style={{ ...ftcTh, textAlign: "right" }}>Rate ($/L)</th>
                <th style={{ ...ftcTh, textAlign: "right" }}>Litres</th>
                <th style={{ ...ftcTh, textAlign: "right" }}>Credit ($)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.placa}-${i}`} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={ftcTd}>{r.plantName}</td>
                  <td style={{ ...ftcTd, color: T.textSecondary, fontFamily: "monospace" }}>{r.placa}</td>
                  <td style={ftcTd}>
                    {r.category}
                    {!r.mapped && (
                      <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 999, background: `${T.accent}22`, color: T.text }}>
                        unmapped
                      </span>
                    )}
                  </td>
                  <td style={{ ...ftcTd, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.rate.toFixed(3)}</td>
                  <td style={{ ...ftcTd, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(r.litres).toLocaleString()}</td>
                  <td style={{ ...ftcTd, textAlign: "right", fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums" }}>
                    ${Math.round(r.credit).toLocaleString()}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ ...ftcTd, color: T.textSecondary, textAlign: "center", padding: 16 }}>No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ ...muted(11), marginTop: 10 }}>
          Estimates based on current ATO rate schedule applied to delivered litres. Confirm with your accountant before lodging.
        </p>
      </div>
    </div>
  );
}

const ftcTh: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 10px", whiteSpace: "nowrap" };
const ftcTd: React.CSSProperties = { padding: "10px", color: T.text, fontSize: 12, verticalAlign: "top" };

function OverviewTab({
  transactions,
  allTransactions,
  period,
  setPeriod,
  customRange,
  setCustomRange,
  demoSuffix,
  speedsolNames,
  isDemo,
  plantItems,
  onOpenFtcReport,
  onOpenDeliveries,
  onOpenFuelVolume,
  onOpenSites,
  periodLabel,
  companyName,
  portalFilters,
  availableTypes,
  availableProjects,
  activeSitesCount,
  availableTags,
  placaToProjectName,
}: {
  transactions: any[];
  allTransactions: any[];
  period: PortalPeriod;
  setPeriod: (p: PortalPeriod) => void;
  customRange: { from?: Date; to?: Date };
  setCustomRange: (r: { from?: Date; to?: Date }) => void;
  demoSuffix: string;
  speedsolNames: string[];
  isDemo: boolean;
  plantItems: any[];
  onOpenFtcReport?: () => void;
  onOpenDeliveries?: () => void;
  onOpenFuelVolume?: () => void;
  onOpenSites?: () => void;
  periodLabel?: string;
  companyName?: string;
  portalFilters?: ReturnType<typeof usePortalFilters>;
  availableTypes?: string[];
  availableProjects?: { id: string; name: string }[];
  activeSitesCount?: number;
  availableTags?: { id: string; name: string }[];
  placaToProjectName?: Record<string, string>;
}) {
  const { data: rates = [] } = useFtcRates();
  const recent = transactions.slice(0, 6);
  const totalLitres = transactions.reduce((s, t) => s + (t.cantidad || 0), 0);
  const numDeliveries = transactions.length;
  const avgDrop = numDeliveries > 0 ? totalLitres / numDeliveries : 0;
  const totalSpend = transactions.reduce((s, t) => s + (t.dinero_total || 0), 0);

  // Previous-period comparison: same window length, immediately preceding.
  const previousTransactions = useMemo(() => {
    if (period === "custom") return [];
    const days = PERIOD_DAYS[period];
    if (days == null) return [];
    const cutoffEnd = subDays(new Date(), days);
    const cutoffStart = subDays(cutoffEnd, days);
    const endStr = format(cutoffEnd, "yyyy-MM-dd");
    const startStr = format(cutoffStart, "yyyy-MM-dd");
    return allTransactions.filter((t: any) => {
      const d = t.date || "";
      return d >= startStr && d < endStr;
    });
  }, [allTransactions, period]);
  const prevLitres = previousTransactions.reduce((s: number, t: any) => s + (t.cantidad || 0), 0);
  const prevSpend = previousTransactions.reduce((s: number, t: any) => s + (t.dinero_total || 0), 0);
  const prevDeliveries = previousTransactions.length;
  const prevAvg = prevDeliveries > 0 ? prevLitres / prevDeliveries : 0;
  const pct = (curr: number, prev: number): number | null =>
    prev === 0 ? null : ((curr - prev) / prev) * 100;

  // Identify trucks in the visible window — prefer SCA fleet name, fall back
  // to driver name, then a generic label. Keep top 4 by litres; the rest
  // roll into "Other".
  const truckSeries = useMemo(() => {
    const truckOf = (t: any) =>
      (t.nombre_flota || t.nombre_vendedor || "Fleet").toString().trim() || "Fleet";
    const totals: Record<string, number> = {};
    transactions.forEach((t: any) => {
      const k = truckOf(t);
      totals[k] = (totals[k] || 0) + (t.cantidad || 0);
    });
    const ranked = Object.entries(totals).sort(([, a], [, b]) => b - a);
    const top = ranked.slice(0, 4).map(([k]) => k);
    const otherSet = new Set(ranked.slice(4).map(([k]) => k));
    return { truckOf, top, otherSet, hasOther: otherSet.size > 0, totals };
  }, [transactions]);

  // Daily trend series for the sparklines + growth chart.
  // Each row carries one numeric key per truck (e.g. row["BOWSR-01"]) so the
  // stacked area chart can render every truck as its own coloured band.
  const dailyTrend = useMemo(() => {
    const keys = [...truckSeries.top, ...(truckSeries.hasOther ? ["Other"] : [])];
    const m: Record<string, any> = {};
    transactions.forEach((t: any) => {
      const d = (t.date || "").slice(0, 10);
      if (!d) return;
      if (!m[d]) {
        m[d] = { litres: 0, revenue: 0, deliveries: 0 };
        keys.forEach((k) => (m[d][k] = 0));
      }
      const litres = t.cantidad || 0;
      m[d].litres += litres;
      m[d].revenue += t.dinero_total || 0;
      m[d].deliveries += 1;
      const truck = truckSeries.truckOf(t);
      const bucket = truckSeries.top.includes(truck) ? truck : (truckSeries.hasOther ? "Other" : truck);
      if (bucket in m[d]) m[d][bucket] += litres;
    });
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]: [string, any]) => ({ date: format(parseISO(d), "d MMM"), ...v }));
  }, [transactions, truckSeries]);
  const truckKeys = useMemo(
    () => [...truckSeries.top, ...(truckSeries.hasOther ? ["Other"] : [])],
    [truckSeries],
  );
  // Vivid, distinct palette so multiple trucks read clearly on the cream surface.
  const TRUCK_COLORS = ["#2A6A2E", "#2563EB", "#E85D1E", "#7A5300", "#5F6B61"];
  const sparkLitres = dailyTrend.map((d) => ({ v: d.litres }));
  const sparkRevenue = dailyTrend.map((d) => ({ v: d.revenue }));
  const sparkDeliveries = dailyTrend.map((d) => ({ v: d.deliveries }));
  const sparkAvg = dailyTrend.map((d) => ({ v: d.deliveries ? d.litres / d.deliveries : 0 }));

  // Donut: volume by site (top 5 + Other).
  const donutData = useMemo(() => {
    const m: Record<string, number> = {};
    transactions.forEach((t: any) => {
      // Only group by an actual mapped Project. Never fall back to
      // SCA WEB fields like `ciudad` or `nombre_cliente1` — those are
      // upstream delivery city / customer names (e.g. "Chiconamel")
      // and don't represent customer Projects. Everything without a
      // mapped project rolls up into a single "Unassigned" bucket.
      const placa = (t.placa || "").toString().trim();
      const project = placa && placaToProjectName ? placaToProjectName[placa] : undefined;
      // Never fall back to SCA WEB fields (ciudad / nombre_cliente1 /
      // estacion). If the placa isn't mapped to a Project we'd rather
      // show nothing than leak an upstream city or customer name.
      if (!project) return;
      m[project] = (m[project] || 0) + (t.cantidad || 0);
    });
    const sorted = Object.entries(m).sort(([, a], [, b]) => b - a);
    const top5 = sorted.slice(0, 5);
    const other = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    const rows = top5.map(([name, value]) => ({ name, value }));
    if (other > 0) rows.push({ name: "Other", value: other });
    const total = rows.reduce((s, r) => s + r.value, 0);
    return { rows, total };
  }, [transactions, placaToProjectName]);

  const DONUT_COLORS = ["#2A6A2E", "#7A5300", "#2B3D8E", "#5F6B61", "#B43A2E", "#C7CCC1"];
  const prefix = period === "day" ? "Daily" : period === "week" ? "Weekly" : period === "month" ? "Monthly" : "All-time";

  // "Active Sites" reflects the customer's active Projects (sites the
  // client has set up), not raw SpeedSol delivery locations. SCA fields
  // (ciudad / nombre_cliente1 / estacion) must not be surfaced as site
  // labels in the portal.
  const sitesSize = typeof activeSitesCount === "number"
    ? activeSitesCount
    : (availableProjects?.length ?? 0);

  // FTC savings — apply off-road / plant rate to total litres as a conservative estimate
  const ftcRate = useMemo(() => {
    const off = rates.find((r: any) => /off-road|machinery|plant/i.test(r.equipment_type));
    return Number((off || rates[0])?.rate_per_litre || 0);
  }, [rates]);
  const ftcSavings = totalLitres * ftcRate;

  // Plant breakdown — group by placa, then resolve to a friendly
  // "Make Model (size)" label from the plant items list.
  const placaLabel = useMemo(() => {
    const map = new Map<string, string>();
    (plantItems || []).forEach((pi: any) => {
      if (!pi?.placa) return;
      const make = pi.manufacturer ? `${pi.manufacturer} ` : "";
      const model = pi.model || pi.name?.split(" (")[0] || "";
      const size = pi.size ? ` (${pi.size})` : "";
      const label = (make + model).trim() || pi.name || pi.placa;
      map.set(String(pi.placa), `${label}${size}`.trim());
    });
    return map;
  }, [plantItems]);

  const plantBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      const key = (t.placa || t.identificador_cliente1 || "Unassigned").toString().trim() || "Unassigned";
      map.set(key, (map.get(key) || 0) + (t.cantidad || 0));
    });
    return Array.from(map.entries())
      .map(([placa, litres]) => ({
        name: placaLabel.get(placa) || placa,
        placa,
        litres,
      }))
      .sort((a, b) => b.litres - a.litres);
  }, [transactions, placaLabel]);
  const topPlants = plantBreakdown.slice(0, 6);
  const topPlant = plantBreakdown[0];

  return (
    <OverviewTactical
      transactions={transactions}
      companyName={companyName}
      periodLabel={periodLabel}
      period={period}
      setPeriod={setPeriod}
      customRange={customRange}
      setCustomRange={setCustomRange}
      totalLitres={totalLitres}
      numDeliveries={numDeliveries}
      avgDrop={avgDrop}
      prevLitres={prevLitres}
      prevDeliveries={prevDeliveries}
      prevAvg={prevAvg}
      sitesCount={sitesSize}
      donutRows={donutData.rows}
      donutTotal={donutData.total}
      recent={recent}
      onExportCsv={() => {
        const header = ["Date", "Site", "Plant", "Rego", "Litres", "Docket"];
        const rows = transactions.map((t: any) => [
          t.date || "",
          t.estacion || t.ciudad || t.nombre_cliente1 || "",
          t.identificador_cliente1 || "",
          t.placa || "",
          (t.cantidad || 0).toFixed(2),
          t.id ?? "",
        ]);
        const safeName = (companyName || "deliveries").replace(/[^A-Za-z0-9]+/g, "-");
        const safePeriod = (periodLabel || "current").replace(/\s+/g, "-");
        downloadCSV([header, ...rows], `${safeName}-deliveries-${safePeriod}.csv`);
      }}
      onOpenDeliveries={onOpenDeliveries}
      onOpenFuelVolume={onOpenFuelVolume}
      onOpenSites={onOpenSites}
      portalFilters={portalFilters}
      availableTypes={availableTypes}
      availableProjects={availableProjects}
      availableTags={availableTags}
    />
  );
}

// ─── Tactical Overview presentation ───────────────────────────────────
// Dense "command hub" layout: header + KPI bento + live map + top sites
// + truck trend + recent deliveries. Uses semantic tokens so it tracks
// both the light and dark portal palettes.
function OverviewTactical({
  transactions,
  companyName,
  periodLabel,
  period,
  setPeriod,
  customRange,
  setCustomRange,
  totalLitres,
  numDeliveries,
  avgDrop,
  prevLitres,
  prevDeliveries,
  prevAvg,
  sitesCount,
  donutRows,
  donutTotal,
  recent,
  onExportCsv,
  onOpenDeliveries,
  onOpenFuelVolume,
  onOpenSites,
  portalFilters,
  availableTypes,
  availableProjects,
  availableTags,
}: {
  transactions: any[];
  companyName?: string;
  periodLabel?: string;
  period: PortalPeriod;
  setPeriod: (p: PortalPeriod) => void;
  customRange: { from?: Date; to?: Date };
  setCustomRange: (r: { from?: Date; to?: Date }) => void;
  totalLitres: number;
  numDeliveries: number;
  avgDrop: number;
  prevLitres: number;
  prevDeliveries: number;
  prevAvg: number;
  sitesCount: number;
  donutRows: { name: string; value: number }[];
  donutTotal: number;
  recent: any[];
  onExportCsv: () => void;
  onOpenDeliveries?: () => void;
  onOpenFuelVolume?: () => void;
  onOpenSites?: () => void;
  portalFilters?: ReturnType<typeof usePortalFilters>;
  availableTypes?: string[];
  availableProjects?: { id: string; name: string }[];
  activeSitesCount?: number;
  availableTags?: { id: string; name: string }[];
}) {
  const fmtBig = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}k`
        : `${Math.round(n)}`;
  const pctChange = (curr: number, prev: number): number | null =>
    prev === 0 ? null : ((curr - prev) / prev) * 100;
  const litresPct = pctChange(totalLitres, prevLitres);
  const dropsPct = pctChange(numDeliveries, prevDeliveries);
  const avgPct = pctChange(avgDrop, prevAvg);

  // KPI progress visualisations: width tracks current vs (current + prev)
  // so a healthy growth fills the bar past the midline.
  const ratio = (curr: number, prev: number): number => {
    const total = curr + prev;
    if (total <= 0) return 0;
    return Math.max(4, Math.min(100, Math.round((curr / total) * 100)));
  };

  // Top projects — pad to at least 2 rows using availableProjects so the
  // section always shows a meaningful preview, even on quiet periods.
  const topProjectsRaw = donutRows.slice(0, 5);
  const topSites = (() => {
    if (topProjectsRaw.length >= 2) return topProjectsRaw;
    const taken = new Set(topProjectsRaw.map((r) => r.name));
    const padded = [...topProjectsRaw];
    for (const p of availableProjects || []) {
      if (padded.length >= 2) break;
      if (!taken.has(p.name)) {
        padded.push({ name: p.name, value: 0 });
        taken.add(p.name);
      }
    }
    return padded;
  })();
  const topSiteMax = topSites.reduce((m, r) => Math.max(m, r.value), 0);

  const Delta = ({ value }: { value: number | null }) => {
    if (value == null) return <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/70">NEW</span>;
    const up = value >= 0;
    return (
      <span
        className="text-[10px] font-bold tracking-wider tabular-nums"
        style={{ color: up ? "var(--positive)" : "var(--negative)" }}
      >
        {up ? "▲" : "▼"} {Math.abs(value).toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Period selector — first control, sits above the Overview header */}
      <div className="flex items-center flex-wrap gap-3">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full border"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {(["day", "week", "month", "all"] as PortalPeriod[]).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all"
                style={{
                  color: active ? "var(--background)" : "var(--text-secondary, var(--muted-foreground))",
                  background: active ? "var(--accent)" : "transparent",
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            );
          })}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all inline-flex items-center gap-1.5"
                style={{
                  color: period === "custom" ? "var(--background)" : "var(--text-secondary, var(--muted-foreground))",
                  background: period === "custom" ? "var(--accent)" : "transparent",
                }}
              >
                <CalendarIcon className="w-3 h-3" />
                Custom
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: customRange.from, to: customRange.to } as any}
                onSelect={(r: any) => {
                  setCustomRange({ from: r?.from, to: r?.to });
                  if (r?.from) setPeriod("custom");
                }}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Header row */}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-1 flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
          <span>{companyName || "Account"}</span>
          <span className="opacity-50">·</span>
          <span className="opacity-80">{PERIOD_LABELS[period]}</span>
          {period === "custom" && customRange.from && (
            <span className="opacity-80">
              ({format(customRange.from, "d MMM")}{customRange.to ? ` – ${format(customRange.to, "d MMM")}` : ""})
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">Overview</h1>
      </div>

      {/* KPI bento — 2x2 on mobile, 4-up on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Fuel volume — hero KPI with progress */}
        <button
          type="button"
          onClick={onOpenFuelVolume}
          disabled={!onOpenFuelVolume}
          className="text-left rounded-2xl p-4 border transition-all hover:border-[var(--accent)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:border-[var(--border)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fuel Volume</span>
            <Delta value={litresPct} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground tabular-nums">{fmtBig(totalLitres)}</span>
            <span className="text-[10px] font-medium" style={{ color: "var(--accent)" }}>LITRES</span>
          </div>
          <div className="mt-3 h-1 w-full rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
            <div className="h-full rounded-full transition-all" style={{ background: "var(--accent)", width: `${ratio(totalLitres, prevLitres)}%` }} />
          </div>
        </button>

        {/* Deliveries — segmented bar */}
        <button
          type="button"
          onClick={onOpenDeliveries}
          disabled={!onOpenDeliveries}
          className="text-left rounded-2xl p-4 border transition-all hover:border-[var(--accent)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:border-[var(--border)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deliveries</span>
            <Delta value={dropsPct} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground tabular-nums">{numDeliveries.toLocaleString()}</span>
            <span className="text-[10px] font-medium text-muted-foreground">DROPS</span>
          </div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => {
              const fillUpTo = Math.round((Math.min(numDeliveries, prevDeliveries + numDeliveries) / Math.max(1, prevDeliveries + numDeliveries)) * 5);
              const active = i < fillUpTo;
              return (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full"
                  style={{ background: active ? "var(--accent)" : "var(--border-subtle)" }}
                />
              );
            })}
          </div>
        </button>

        {/* Active sites */}
        <button
          type="button"
          onClick={onOpenSites}
          disabled={!onOpenSites}
          className="text-left rounded-2xl p-4 border transition-all hover:border-[var(--accent)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:border-[var(--border)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Sites</span>
            {sitesCount > 0 ? (
              <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider" style={{ color: "var(--positive)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--positive)" }} />
                LIVE
              </span>
            ) : (
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground tabular-nums">{sitesCount.toLocaleString()}</span>
            <span className="text-[10px] font-medium text-muted-foreground">{sitesCount === 1 ? "SITE" : "SITES"}</span>
          </div>
          {sitesCount === 0 ? (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                No deliveries yet. Sites appear here once fuel is delivered to a project.
              </p>
              <span className="text-[10px] font-bold tracking-wider" style={{ color: "var(--accent)" }}>
                View Projects →
              </span>
            </div>
          ) : (
            <div className="mt-3 text-[10px] text-muted-foreground/80 truncate">
              {topSites[0]?.name}
            </div>
          )}
        </button>

        {/* Avg per load */}
        <div className="rounded-2xl p-4 border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg / Load</span>
            <Delta value={avgPct} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground tabular-nums">{avgDrop > 0 ? fmtBig(avgDrop) : "—"}</span>
            <span className="text-[10px] font-medium text-muted-foreground">LITRES</span>
          </div>
          <div className="mt-3 h-1 w-full rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
            <div className="h-full rounded-full transition-all" style={{ background: "var(--accent)", width: `${ratio(avgDrop, prevAvg)}%` }} />
          </div>
        </div>
      </div>

      {/* Active sites quick action */}
      {onOpenSites && (
        <div className="flex justify-end -mt-2 mb-2">
          <button
            type="button"
            onClick={onOpenSites}
            className="text-[10px] font-bold tracking-wider transition-colors hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            VIEW ALL PROJECTS →
          </button>
        </div>
      )}

      {/* Filters summary + Export — sits between KPIs and the map */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {portalFilters && (
          <details>
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                border: `1px solid ${T.border}`,
                borderRadius: 999,
                background: T.surface,
                fontSize: 11,
                fontFamily: T.sansHead,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.textSecondary,
              }}
            >
              <Filter size={12} />
              Filters
              {(portalFilters.filters.types.length +
                portalFilters.filters.projects.length +
                portalFilters.filters.tags.length) > 0 && (
                <span
                  style={{
                    background: T.accent,
                    color: "#0E1F10",
                    borderRadius: 999,
                    padding: "1px 7px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {portalFilters.filters.types.length +
                    portalFilters.filters.projects.length +
                    portalFilters.filters.tags.length}
                </span>
              )}
            </summary>
            <div style={{ marginTop: 8 }}>
              <PortalFilterBar
                filters={portalFilters.filters}
                onTypes={portalFilters.setTypes}
                onProjects={portalFilters.setProjects}
                onTags={portalFilters.setTags}
                onReset={portalFilters.reset}
                availableTypes={availableTypes || []}
                availableProjects={availableProjects || []}
                availableTags={availableTags || []}
              />
            </div>
          </details>
        )}
        <button
          type="button"
          onClick={onExportCsv}
          disabled={transactions.length === 0}
          className="h-10 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          style={{ background: "var(--accent)", color: "var(--background)", boxShadow: "0 4px 16px -6px var(--accent)" }}
        >
          <Download className="w-4 h-4" strokeWidth={2.5} />
          <span className="text-xs font-bold tracking-wider">EXPORT</span>
        </button>
      </div>

      {/* Live truck map block */}
      <div className="relative rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="absolute top-3 left-3 z-10 backdrop-blur-md px-2 py-1 rounded border flex items-center gap-2" style={{ background: "rgba(0,0,0,0.55)", borderColor: "rgba(255,255,255,0.10)" }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
          <span className="text-[9px] font-bold uppercase tracking-tight text-white">Live · Truck Telemetry</span>
        </div>
        <TruckMap height={220} showStops={true} />
      </div>

      {/* Top Projects */}
      <div className="rounded-2xl p-5 border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Top Projects</h3>
          {onOpenSites && (
            <button
              type="button"
              onClick={onOpenSites}
              className="text-[10px] font-bold tracking-wider"
              style={{ color: "var(--accent)" }}
            >
              VIEW ALL →
            </button>
          )}
        </div>
        {topSites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No project activity for this period.</p>
        ) : (
          <div className="space-y-4">
            {topSites.map((r) => {
              const pctOfTop = topSiteMax > 0 ? (r.value / topSiteMax) * 100 : 0;
              const pctOfTotal = donutTotal > 0 ? (r.value / donutTotal) * 100 : 0;
              return (
                <div key={r.name} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-medium gap-2">
                    <span className="text-foreground truncate">{r.name}</span>
                    <span className="text-foreground tabular-nums shrink-0">
                      {fmtBig(r.value)} L <span className="text-muted-foreground font-normal">· {pctOfTotal.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full" style={{ background: "var(--border-subtle)" }}>
                    <div className="h-full rounded-full transition-all" style={{ background: "var(--accent)", width: `${pctOfTop}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent deliveries */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Deliveries</h3>
        {recent.length === 0 ? (
          <div className="rounded-2xl p-6 text-center border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-xs text-muted-foreground">No deliveries recorded for this period.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((t: any, i: number) => {
              const isFirst = i === 0;
              return (
                <div
                  key={t.id || i}
                  className="p-3 rounded-xl flex items-center gap-4 border transition-colors"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div
                    className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border"
                    style={{
                      background: isFirst ? "var(--accent-light)" : "var(--border-subtle)",
                      borderColor: isFirst ? "var(--accent)" : "var(--border)",
                    }}
                  >
                    <Droplet className="w-5 h-5" style={{ color: isFirst ? "var(--accent)" : "var(--text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {(t.placa || t.nombre_cliente1 || "—") + " • " + fmtBig(t.cantidad || 0) + " L"}
                      {t.producto ? ` ${t.producto}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {t.estacion || t.ciudad || "Unknown site"} · {t.date ? formatDate(parseISO(t.date)) : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Legacy chart/site/recent block (no longer rendered) ──────────────
function _LegacyOverviewExtras_unused() {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LegacyOverviewBlocks_unused(opts: any) {
  // The previous Overview layout used the JSX below. Kept inert (never
  // called) to make the diff smaller and preserve historical intent.
  const { truckKeys, dailyTrend, TRUCK_COLORS, truckSeries, periodLabel, donutData, DONUT_COLORS, topPlants, recent, T } = opts;
  return (
    <div className="hidden">
      {/* Litres growth + Volume by site row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Litres delivered by truck</h2>
              <p className="text-xs font-medium text-muted-foreground/80 mt-0.5">
                Stacked daily volume per bowser · {periodLabel?.toLowerCase()}
              </p>
            </div>
            <div className="flex gap-3 shrink-0 flex-wrap justify-end max-w-[55%]">
              {truckKeys.map((k, i) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  title={`${k}: ${Math.round(truckSeries.totals[k] || 0).toLocaleString()} L`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: TRUCK_COLORS[i % TRUCK_COLORS.length] }} />
                  {k}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                <span className="w-2.5 h-1 rounded" style={{ background: "#0E1F10" }} />
                Drops
              </span>
            </div>
          </div>
          <div style={{ height: 260 }}>
            {dailyTrend.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    {truckKeys.map((k, i) => (
                      <linearGradient key={k} id={`truck-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TRUCK_COLORS[i % TRUCK_COLORS.length]} stopOpacity={0.85} />
                        <stop offset="100%" stopColor={TRUCK_COLORS[i % TRUCK_COLORS.length]} stopOpacity={0.35} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="#0E1F10" strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} minTickGap={32} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0E1F10", border: "none", borderRadius: 8, fontSize: 12, padding: "8px 12px", color: "#C8F26A" }}
                    labelStyle={{ color: "#C8F26A", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}
                    itemStyle={{ color: "#C8F26A" }}
                    formatter={(v: number, name: string) =>
                      name === "deliveries"
                        ? [v.toLocaleString(), "Drops"]
                        : [`${Number(v).toLocaleString()} L`, name]
                    }
                  />
                  {truckKeys.map((k, i) => (
                    <Area
                      key={k}
                      yAxisId="left"
                      type="monotone"
                      dataKey={k}
                      stackId="trucks"
                      stroke={TRUCK_COLORS[i % TRUCK_COLORS.length]}
                      strokeWidth={1.5}
                      fill={`url(#truck-fill-${i})`}
                      isAnimationActive={false}
                    />
                  ))}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="deliveries"
                    stroke="#0E1F10"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground">
                Trend appears with 2+ data points.
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="font-display text-lg font-bold text-foreground">Volume by site</h2>
            <p className="text-xs font-medium text-muted-foreground/80 mt-0.5">Top locations · {periodLabel.toLowerCase()}</p>
          </div>
          <div style={{ height: 200 }} className="flex flex-col">
            <div className="relative flex-1 min-h-0">
              {donutData.rows.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData.rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="68%" outerRadius="92%" stroke="#FFFFFF" strokeWidth={3} isAnimationActive={false}>
                        {donutData.rows.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="font-display text-[24px] font-bold tabular-nums text-foreground leading-tight">
                      {donutData.total >= 1000 ? `${(donutData.total / 1000).toFixed(1)}k` : donutData.total.toFixed(0)}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Total L</div>
                  </div>
                </>
              )}
            </div>
          </div>
          {donutData.rows.length > 0 && (
            <ul className="mt-6 space-y-2">
              {donutData.rows.map((r, i) => (
                <li key={r.name} className="flex items-center gap-2 text-[12px] text-foreground">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="flex-1 font-semibold truncate">{r.name}</span>
                  <span className="font-bold tabular-nums text-muted-foreground">
                    {donutData.total ? `${((r.value / donutData.total) * 100).toFixed(0)}%` : "0%"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Highest-using plant — horizontal bar chart */}
      {topPlants.length > 0 && (
        <div style={card}>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Top Plant by Volume</div>
          <div style={{ ...muted(11), marginBottom: 10 }}>Litres per plate / plant this period</div>
          <div style={{ width: "100%", height: Math.max(140, topPlants.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPlants} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: T.textSecondary, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: `${T.chart}14` }}
                  contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12 }}
                  formatter={(v: any) => fmtL(Number(v))}
                />
                <Bar dataKey="litres" fill={T.chart} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Live truck location */}
      <TruckMap height={260} showStops={true} />

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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{t.placa || t.nombre_cliente1 || "—"}</span>
                  {t.producto && (
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: T.accent + "1f", color: T.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{t.producto}</span>
                  )}
                </div>
                <div style={muted(11)}>
                  {t.date ? formatDate(parseISO(t.date)) : "—"}
                  {t.estacion ? <> · {t.estacion}</> : null}
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
function SignedDocketsCard({ clientAccountId }: { clientAccountId: number | null }) {
  const [open, setOpen] = useState<any | null>(null);
  const { data: dockets = [], isLoading, error } = useQuery({
    queryKey: ["signed-dockets", clientAccountId],
    queryFn: async () => {
      if (!clientAccountId) return [];
      const { data, error } = await supabase
        .from("dispatch_stops" as any)
        .select("*")
        .eq("client_account_id", clientAccountId)
        .eq("status", "completed")
        .not("customer_signature", "is", null)
        .order("signed_at", { ascending: false, nullsFirst: false })
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!clientAccountId,
  });
  const { data: completedCount = 0 } = useQuery({
    queryKey: ["signed-dockets-completed-count", clientAccountId],
    queryFn: async () => {
      if (!clientAccountId) return 0;
      const { data, error } = await supabase
        .from("dispatch_stops" as any)
        .select("id")
        .eq("client_account_id", clientAccountId)
        .eq("status", "completed");
      if (error) throw error;
      return (data || []).length;
    },
    enabled: !!clientAccountId,
  });
  const { data: projectById = {} } = useQuery({
    queryKey: ["signed-dockets-projects", dockets.map((d: any) => d.project_id).filter(Boolean).sort().join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(dockets.map((d: any) => d.project_id).filter(Boolean)));
      if (!ids.length) return {} as Record<string, any>;
      const { data, error } = await supabase.from("projects").select("id, name, site_address").in("id", ids);
      if (error) return {} as Record<string, any>;
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: dockets.length > 0,
  });
  const { data: truckById = {} } = useQuery({
    queryKey: ["signed-dockets-trucks", dockets.map((d: any) => d.truck_id).filter(Boolean).sort().join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(dockets.map((d: any) => d.truck_id).filter(Boolean)));
      if (!ids.length) return {} as Record<string, any>;
      const { data, error } = await supabase.from("trucks" as any).select("id, name, rego").in("id", ids);
      if (error) return {} as Record<string, any>;
      const map: Record<string, any> = {};
      (data || []).forEach((t: any) => { map[t.id] = t; });
      return map;
    },
    enabled: dockets.length > 0,
  });
  const { data: driverNameById = {} } = useQuery({
    queryKey: ["signed-dockets-drivers", dockets.map((d: any) => d.driver_user_id).filter(Boolean).sort().join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(dockets.map((d: any) => d.driver_user_id).filter(Boolean)));
      if (!ids.length) return {} as Record<string, string>;
      const { data, error } = await supabase.from("user_roles").select("user_id, full_name, email").in("user_id", ids);
      if (error) return {} as Record<string, string>;
      const map: Record<string, string> = {};
      (data || []).forEach((u: any) => { map[u.user_id] = u.full_name || u.email || ""; });
      return map;
    },
    enabled: dockets.length > 0,
  });
  return (
    <div id="signed-dockets" style={{ ...card, scrollMarginTop: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...labelStyle, marginBottom: 0 }}>Signed Dockets</div>
        <div style={muted(11)}>
          {dockets.length} signed
        </div>
      </div>
      {isLoading && <p style={muted(13)}>Loading signed dockets…</p>}
      {error && <p style={{ ...muted(13), color: "#9F2A1D" }}>Signed dockets could not be loaded. Please refresh and try again.</p>}
      {!isLoading && !error && dockets.length === 0 && (
        <div style={{ border: `1px dashed ${T.border}`, borderRadius: 8, padding: 14, background: T.surfaceRaised }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>No signed dockets yet</div>
          <div style={muted(12)}>
            {completedCount > 0
              ? `${completedCount} completed delivery ${completedCount === 1 ? "record is" : "records are"} below, but none have a captured customer signature yet.`
              : "Signed dockets will appear here as soon as a driver captures the customer and driver signatures."}
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {dockets.map((d, i) => {
          const project = d.project_id ? projectById[d.project_id] : null;
          const truck = d.truck_id ? truckById[d.truck_id] : null;
          return (
            <button
              key={d.id}
              onClick={() => setOpen({ ...d, project, truck })}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                background: "transparent", border: "none", textAlign: "left",
                cursor: "pointer", color: T.text,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {project?.name || d.site_name}
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(122,168,77,0.18)", color: "#2A6A2E", letterSpacing: "0.05em" }}>SIGNED</span>
                </div>
                <div style={muted(11)}>
                  {d.signed_at ? format(parseISO(d.signed_at), "d MMM yyyy · HH:mm")
                    : d.completed_at ? format(parseISO(d.completed_at), "d MMM yyyy · HH:mm") : ""}
                  {d.customer_name ? ` · ${d.customer_name}${d.customer_role ? `, ${d.customer_role}` : ""}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.chart, marginLeft: 12 }}>
                {Number(d.delivered_litres || 0).toLocaleString()} L
              </div>
            </button>
          );
        })}
      </div>
      {open && (
        <div
          onClick={() => setOpen(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(14,31,16,0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", color: "#0E1F10", borderRadius: 12, padding: 20, maxWidth: 480, width: "100%", maxHeight: "90vh", overflow: "auto" }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>{open.site_name}</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              {open.signed_at ? format(parseISO(open.signed_at), "d MMM yyyy · HH:mm") : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12, fontSize: 12 }}>
              {open.project?.name && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Project</div>
                  <div style={{ fontWeight: 600, color: "#0E1F10" }}>{open.project.name}</div>
                </div>
              )}
              {open.address && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Address</div>
                  <div style={{ color: "#0E1F10" }}>{open.address}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Delivered</div>
                <div style={{ fontWeight: 700, color: "#0E1F10" }}>{Number(open.delivered_litres || 0).toLocaleString()} L</div>
              </div>
              {(open.truck?.name || open.truck?.rego) && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Truck</div>
                  <div style={{ color: "#0E1F10" }}>
                    {open.truck?.name}{open.truck?.rego ? ` · ${open.truck.rego}` : ""}
                  </div>
                </div>
              )}
              {open.driver_user_id && driverNameById[open.driver_user_id] && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>Driver</div>
                  <div style={{ color: "#0E1F10" }}>{driverNameById[open.driver_user_id]}</div>
                </div>
              )}
            </div>

            {Array.isArray(open.products?.lines) && open.products.lines.length > 0 && (
              <div style={{ marginBottom: 12, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", padding: "8px 10px", background: "#f7f7f5" }}>
                  Equipment fuelled ({open.products.lines.length})
                </div>
                <div>
                  {open.products.lines.map((ln: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderTop: idx === 0 ? "none" : "1px solid #f0f0f0", fontSize: 12 }}>
                      <span style={{ color: "#0E1F10", minWidth: 0, marginRight: 8 }}>
                        <strong>{ln.placa || "—"}</strong>
                        {ln.product ? ` · ${ln.product}` : ""}
                        {ln.fleet ? ` · ${ln.fleet}` : ""}
                      </span>
                      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0E1F10" }}>
                        {Number(ln.litres || 0).toFixed(2)} L
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {open.signature_notes && (
              <div style={{ fontSize: 12, marginBottom: 12, color: "#444" }}>
                <strong>Notes:</strong> {open.signature_notes}
              </div>
            )}
            {open.customer_signature && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", marginBottom: 4 }}>
                  Customer — {open.customer_name}{open.customer_role ? ` · ${open.customer_role}` : ""}
                </div>
                <img src={open.customer_signature} alt="Customer signature" style={{ maxWidth: "100%", border: "1px solid #eee", borderRadius: 6 }} />
              </div>
            )}
            {open.driver_signature && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", marginBottom: 4 }}>
                  Driver{open.driver_user_id && driverNameById[open.driver_user_id] ? ` — ${driverNameById[open.driver_user_id]}` : ""}
                </div>
                <img src={open.driver_signature} alt="Driver signature" style={{ maxWidth: "100%", border: "1px solid #eee", borderRadius: 6 }} />
              </div>
            )}
            <button onClick={() => setOpen(null)} style={{ marginTop: 8, padding: "10px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", width: "100%" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

  const [plantFilter, setPlantFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Bulk docket selection
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => { setSelected(new Set()); setSelectMode(false); };
  const openCombinedDockets = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(",");
    const extra = demoSuffix ? `&${demoSuffix.slice(1)}` : "";
    window.open(`/docket/multi?ids=${ids}${extra}`, "_blank");
  };

  // Plant items that actually appear in this client's transactions
  const plantOptions = useMemo(() => {
    const seen = new Set<string>();
    transactions.forEach((t) => {
      const p = (t.placa || "").toString().trim();
      if (p) seen.add(p);
    });
    return Array.from(seen)
      .map((placa) => {
        const pi = plantItems.find(
          (x) => (x.placa || "").toString().trim().toLowerCase() === placa.toLowerCase()
        );
        return { placa, label: pi?.name || placa };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [transactions, plantItems]);

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
      if (plantFilter !== "all") {
        const placa = (t.placa || "").toString().trim();
        if (placa.toLowerCase() !== plantFilter.toLowerCase()) return false;
      }
      if (projectFilter !== "all") {
        const placa = (t.placa || "").toString().trim();
        if (placaToProject[placa] !== projectFilter) return false;
      }
      const d = t.date || "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [transactions, plantFilter, projectFilter, placaToProject, fromDate, toDate]);

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
      <SignedDocketsCard clientAccountId={clientAccountId} />
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
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={inputStyle}>
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)} style={inputStyle}>
          <option value="all">All Plant</option>
          {plantOptions.map((p) => <option key={p.placa} value={p.placa}>{p.label}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} placeholder="From" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} placeholder="To" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={muted(12)}>
          {filtered.length.toLocaleString()} deliveries · {fmtL(totalLitres)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {selectMode ? (
            <>
              <GhostButton
                onClick={() => {
                  const allIds = filtered.map((t) => Number(t.id)).filter((n) => Number.isFinite(n));
                  const allSelected = allIds.every((id) => selected.has(id));
                  setSelected(allSelected ? new Set() : new Set(allIds));
                }}
                disabled={filtered.length === 0}
              >
                {filtered.length > 0 && filtered.every((t) => selected.has(Number(t.id))) ? "Deselect all" : "Select all"}
              </GhostButton>
              <GhostButton onClick={clearSelection}>Cancel</GhostButton>
              <GhostButton onClick={openCombinedDockets} disabled={selected.size === 0}>
                Download {selected.size > 0 ? `${selected.size} ` : ""}docket{selected.size === 1 ? "" : "s"}
              </GhostButton>
            </>
          ) : (
            <GhostButton onClick={() => setSelectMode(true)} disabled={filtered.length === 0}>
              Select dockets
            </GhostButton>
          )}
          <GhostButton onClick={exportDeliveries} disabled={filtered.length === 0}>Export CSV</GhostButton>
        </div>
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
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={selected.has(Number(t.id))}
                      onChange={() => toggleSelected(Number(t.id))}
                      aria-label="Select delivery"
                      style={{ width: 18, height: 18, accentColor: T.accent, alignSelf: "center", cursor: "pointer" }}
                    />
                  )}
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
                          color: T.text, border: `1px solid ${T.accent}55`, background: `${T.accent}11`,
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
        color: sortKey === k ? T.text : T.muted,
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
                color: period === p ? T.text : T.textSecondary,
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
            <div style={{ fontSize: 32, fontFamily: T.sansHead, fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
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
  allTransactions,
  clientAccountId,
}: {
  transactions: any[];
  allTransactions: any[];
  clientAccountId: number | null;
}) {
  const { data: projects = [], isLoading: prLoading } = useProjects(clientAccountId);
  const { data: assignments = [] } = useProjectAssignments(clientAccountId);
  const { data: plantItems = [] } = usePlantItems(clientAccountId);
  const txnIds = useMemo(() => transactions.map((t) => t.id).filter(Boolean), [transactions]);
  const { data: overrides = {} } = useTransactionOverrides(txnIds);

  // Track which project card the user has drilled into (full-history view).
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("week");

  // ── Full-history attribution (for the drill-down panel) ─────────────
  // Keyed: projectId → bucketKey ("yyyy-MM-dd" / "yyyy-Www" / "yyyy-MM")
  // → { litres, deliveries }. Uses allTransactions, not the period slice.
  const allTxnIds = useMemo(
    () => allTransactions.map((t) => t.id).filter(Boolean),
    [allTransactions],
  );
  const { data: allOverrides = {} } = useTransactionOverrides(allTxnIds);

  const history = useMemo(() => {
    const itemAssignments = groupAssignmentsByPlantItem(assignments as any);
    const resolveProject = (itemId: string | undefined, isoDate: string | null) =>
      projectForItemAt(itemAssignments, itemId, isoDate);
    const placaToItemId: Record<string, string> = {};
    plantItems.forEach((pi) => {
      const placa = (pi.placa || "").toString().trim();
      if (placa) placaToItemId[placa] = pi.id;
    });

    const out: Record<
      string,
      { day: Record<string, { litres: number; deliveries: number }>; week: Record<string, { litres: number; deliveries: number }>; month: Record<string, { litres: number; deliveries: number }> }
    > = {};

    allTransactions.forEach((t) => {
      if (!t.date) return;
      const placa = (t.placa || "").toString().trim();
      const litres = t.cantidad || 0;
      const txnDate = t.fecha || (t.date ? t.date + "T00:00:00.000Z" : null);
      const ov = allOverrides[t.id];
      let pid: string | undefined = ov?.project_id;
      if (!pid && ov?.plant_item_id) pid = resolveProject(ov.plant_item_id, txnDate);
      if (!pid) pid = resolveProject(placaToItemId[placa], txnDate);
      if (!pid) return;
      const d = parseISO(t.date);
      const day = format(d, "yyyy-MM-dd");
      const wk = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const mo = format(d, "yyyy-MM");
      if (!out[pid]) out[pid] = { day: {}, week: {}, month: {} };
      const bump = (bucket: Record<string, { litres: number; deliveries: number }>, key: string) => {
        if (!bucket[key]) bucket[key] = { litres: 0, deliveries: 0 };
        bucket[key].litres += litres;
        bucket[key].deliveries += 1;
      };
      bump(out[pid].day, day);
      bump(out[pid].week, wk);
      bump(out[pid].month, mo);
    });
    return out;
  }, [allTransactions, allOverrides, assignments, plantItems]);

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
          Fuel usage per project — create and assign equipment to projects on the Projects tab.
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
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: T.sansHead, color: T.text, fontVariantNumeric: "tabular-nums" }}>
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
              ? Object.entries(s.topPlant).sort((a, b) => b[1] - a[1])
              : [];
            const maxLitres = topPlant[0]?.[1] || 1;
            const weekly = s
              ? Object.entries(s.weekly).sort((a, b) => b[0].localeCompare(a[0]))
              : [];
            const maxWeekLitres = weekly.reduce((m, [, v]) => Math.max(m, v.litres), 0) || 1;
            const isOpen = expandedProjectId === p.id;
            return (
              <div
                key={p.id}
                style={{ ...card, cursor: "pointer" }}
                onClick={() => setExpandedProjectId((cur) => (cur === p.id ? null : p.id))}
                role="button"
                aria-expanded={isOpen}
              >
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
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedProjectId((cur) => (cur === p.id ? null : p.id));
                      }}
                      style={{
                        alignSelf: "center",
                        background: isOpen ? T.accent : "transparent",
                        color: T.text,
                        border: `1px solid ${T.accent}88`,
                        borderRadius: 999,
                        padding: "8px 14px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isOpen ? "Hide details" : "View details"}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: `1px solid ${T.border}`,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={labelStyle}>Litres (period)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtL(litres)}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Deliveries</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{deliveries}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>CO₂e (t)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontVariantNumeric: "tabular-nums" }}>
                        {fmtNum(co2Tonnes, 2)}
                      </div>
                    </div>
                    <div>
                      <div style={labelStyle}>Equipment on site</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{topPlant.length}</div>
                    </div>
                  </div>
                )}

                {isOpen && topPlant.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                    <div style={{ ...labelStyle, marginBottom: 8 }}>Equipment on site · Fuel used</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {topPlant.map(([name, l]) => (
                        <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                          <span style={{ color: T.textSecondary, width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{name}</span>
                          <div style={{ flex: 1, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${(l / maxLitres) * 100}%`, height: "100%", background: T.chart }} />
                          </div>
                          <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 70, textAlign: "right" }}>{fmtL(l)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isOpen ? (
                  (() => {
                    const buckets = history[p.id]?.[granularity] || {};
                    const entries = Object.entries(buckets).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 24);
                    const maxL = entries.reduce((m, [, v]) => Math.max(m, v.litres), 0) || 1;
                    const totalL = entries.reduce((s, [, v]) => s + v.litres, 0);
                    const totalD = entries.reduce((s, [, v]) => s + v.deliveries, 0);
                    const labelFor = (k: string) => {
                      if (granularity === "day") return format(parseISO(k), "EEE d MMM yyyy");
                      if (granularity === "month") return format(parseISO(k + "-01"), "MMM yyyy");
                      // week
                      const wkEnd = format(addDays(parseISO(k), 6), "dd MMM");
                      return `${format(parseISO(k), "dd MMM")} – ${wkEnd}`;
                    };
                    return (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                          <div style={labelStyle}>Drill-down · All history</div>
                          <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
                            {(["day", "week", "month"] as const).map((g) => (
                              <button
                                key={g}
                                onClick={(e) => { e.stopPropagation(); setGranularity(g); }}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: 10,
                                  fontFamily: T.sansHead,
                                  fontWeight: granularity === g ? 700 : 500,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: granularity === g ? T.text : T.textSecondary,
                                  background: granularity === g ? T.accent : "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {entries.length === 0 ? (
                          <p style={muted(12)}>No fuel attributed to this project yet.</p>
                        ) : (
                          <>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {entries.map(([k, v]) => (
                                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                                  <span style={{ color: T.textSecondary, width: 170, whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{labelFor(k)}</span>
                                  <div style={{ flex: 1, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
                                    <div style={{ width: `${(v.litres / maxL) * 100}%`, height: "100%", background: T.chart }} />
                                  </div>
                                  <span style={{ color: T.muted, fontSize: 11, fontVariantNumeric: "tabular-nums", minWidth: 50, textAlign: "right" }}>{v.deliveries} dlv</span>
                                  <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 80, textAlign: "right" }}>{fmtL(v.litres)}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.border}`, display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted }}>
                              <span style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Showing last {entries.length} {granularity === "day" ? "days" : granularity === "week" ? "weeks" : "months"}</span>
                              <span style={{ color: T.text, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                                {fmtL(totalL)} · {totalD} deliveries
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()
                ) : null}
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

function EmissionsTab({
  transactions,
  companyName,
  placaToProjectName,
}: {
  transactions: any[];
  companyName: string;
  placaToProjectName?: Record<string, string>;
}) {
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
      // Group by the Project the placa is mapped to. Never fall back
      // to SCA WEB customer / city / station names — those leak
      // upstream labels (e.g. "Chiconamel") into the client portal.
      const placa = (t.placa || "").toString().trim();
      const project = placa && placaToProjectName ? placaToProjectName[placa] : undefined;
      if (!project) return;
      map[project] = (map[project] || 0) + (t.cantidad || 0);
    });
    return Object.entries(map)
      .map(([site, litres]) => ({ site, litres, kg: litres * effectiveFactor, tonnes: (litres * effectiveFactor) / 1000 }))
      .sort((a, b) => b.litres - a.litres);
  }, [inPeriod, effectiveFactor, placaToProjectName]);

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
          <div style={{ fontSize: 26, fontFamily: T.sansHead, fontWeight: 700, color: T.text, fontVariantNumeric: "tabular-nums" }}>
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
        estimated_litres: null,
        preferred_date: date,
        notes: notes || null,
        status: "pending",
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg({ type: "ok", text: "Request submitted. We'll confirm shortly." });
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
            <div style={{ fontSize: 12, color: msg.type === "ok" ? T.badgeCompleted : "#FF6B5E", fontFamily: T.sansBody }}>
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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
        <h2 style={sectionTitle}>Equipment</h2>
        <p style={{ ...muted(12), margin: "4px 0 0" }}>
          All plant, machinery and tanks. Drag a card into a project column to reassign — each item belongs to one project at a time.
        </p>
      </div>

      <PlantBoard
        projects={projects}
        equipment={equipment}
        assignments={assignments}
        clientAccountId={clientAccountId}
        tagsByItem={tagsByItem}
        onItemClick={(id) => setSelectedItemId(id)}
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
            <div className="text-xl font-bold text-foreground">${ftcRollup.totalClaim.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
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

      <PlantDetailsModal
        open={!!selectedItemId}
        onClose={() => setSelectedItemId(null)}
        item={plantItems.find((p) => p.id === selectedItemId) || null}
        stats={(() => {
          const it = plantItems.find((p) => p.id === selectedItemId);
          if (!it?.placa) return null;
          const eq = equipment.find((e) => e.placa === it.placa);
          return eq ? { litres: eq.litres, deliveries: eq.deliveries } : null;
        })()}
        tags={selectedItemId ? tagsByItem[selectedItemId] || [] : []}
        projectName={(() => {
          if (!selectedItemId) return null;
          const a = assignments.find((x: any) => x.plant_item_id === selectedItemId && !x.removed_at);
          if (!a) return null;
          return projects.find((p) => p.id === a.project_id)?.name || null;
        })()}
        tokens={{
          surface: T.surface,
          border: T.border,
          text: T.text,
          textSecondary: T.textSecondary,
          muted: T.muted,
          accent: T.accent,
          bg: T.bg,
        }}
      />
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
  companyName,
}: {
  transactions: any[];
  clientAccountId: number | null;
  periodLabel: string;
  companyName: string;
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
  const totalDeliveries = perMachine.reduce((s, m) => s + m.deliveries, 0);

  /**
   * Build the recap PDF in-memory with consistent headers/footers and proper
   * pagination — long tables now break across pages while reprinting their
   * column headers, and every page gets the brand band + page-number footer.
   */
  function buildRecapPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    const TOP_AFTER_HEADER = 60;     // y after the brand band
    const BOTTOM_LIMIT = H - 50;     // last usable y before footer

    const drawPageChrome = () => {
      // Top brand band
      doc.setFillColor(232, 70, 30);
      doc.rect(0, 0, W, 6, "F");
      // Top-right small wordmark
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(232, 70, 30);
      doc.text("ANALYTICS RECAP", W - M, 28, { align: "right" });
    };
    const drawFooterAll = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(237, 227, 210);
        doc.line(M, H - 36, W - M, H - 36);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(139, 115, 85);
        doc.text(`${companyName} · ${periodLabel}`, M, H - 22);
        doc.text(`Page ${i} of ${pageCount}`, W - M, H - 22, { align: "right" });
      }
    };

    drawPageChrome();
    let y = 50;

    // Document title
    doc.setTextColor(61, 43, 26);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("Analytics Recap", M, y); y += 22;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.setTextColor(107, 82, 64);
    doc.text(`${companyName} · ${periodLabel} · Generated ${format(new Date(), "d MMM yyyy")}`, M, y); y += 24;

    // KPI strip
    const kpis = [
      { label: "Tracked litres",  value: fmtL(totalLitres) },
      { label: "Deliveries",      value: totalDeliveries.toLocaleString() },
      { label: "Active machines", value: perMachine.length.toLocaleString() },
      { label: "FTC claimable",   value: fmt$(totalFtc) },
    ];
    const colW = (W - M * 2) / kpis.length;
    doc.setDrawColor(237, 227, 210);
    kpis.forEach((k, i) => {
      const x = M + i * colW;
      doc.roundedRect(x, y, colW - 8, 56, 4, 4, "S");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(139, 115, 85);
      doc.text(k.label.toUpperCase(), x + 10, y + 16);
      doc.setFontSize(15); doc.setTextColor(i === 3 ? 232 : 61, i === 3 ? 70 : 43, i === 3 ? 30 : 26);
      doc.setFont("helvetica", "bold");
      doc.text(k.value, x + 10, y + 40);
      doc.setFont("helvetica", "normal");
    });
    y += 78;

    // Page-break helper. Reserves `needed` pts; if it would overflow, starts a
    // new page (with chrome) and resets y. Returns the new y.
    const ensureSpace = (needed: number): number => {
      if (y + needed <= BOTTOM_LIMIT) return y;
      doc.addPage();
      drawPageChrome();
      y = TOP_AFTER_HEADER;
      return y;
    };

    // Section header (orange tab + title)
    const section = (title: string) => {
      ensureSpace(28);
      doc.setFillColor(232, 70, 30);
      doc.rect(M, y, 3, 14, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(61, 43, 26);
      doc.text(title, M + 10, y + 11);
      y += 22;
    };

    // Re-usable column-header drawer for tables. Returns new y.
    type Col = { header: string; x: number; align?: "left" | "right" };
    const drawTableHeader = (cols: Col[]) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(139, 115, 85);
      cols.forEach(c => doc.text(c.header, c.x, y, { align: c.align ?? "left" }));
      y += 12;
      doc.setDrawColor(237, 227, 210); doc.line(M, y, W - M, y); y += 6;
      doc.setTextColor(61, 43, 26); doc.setFontSize(10);
    };

    // Generic paginated table — reprints column headers when crossing pages.
    const drawTable = <T,>(
      sectionTitleText: string,
      cols: Col[],
      rows: T[],
      renderRow: (r: T, i: number) => void,
      rowHeight = 16,
    ) => {
      section(sectionTitleText);
      drawTableHeader(cols);
      rows.forEach((r, i) => {
        if (y + rowHeight > BOTTOM_LIMIT) {
          doc.addPage();
          drawPageChrome();
          y = TOP_AFTER_HEADER;
          // Reprint section title + headers on the new page so context is preserved.
          section(`${sectionTitleText} (continued)`);
          drawTableHeader(cols);
        }
        renderRow(r, i);
        y += rowHeight;
      });
      y += 12;
    };

    // Top machines (full list, paginated)
    drawTable(
      "Top Machinery",
      [
        { header: "RANK    MACHINE", x: M },
        { header: "LITRES",          x: W - M - 200, align: "right" },
        { header: "DELIVERIES",      x: W - M - 110, align: "right" },
        { header: "FTC",             x: W - M,       align: "right" },
      ],
      perMachine,
      (m, i) => {
        doc.text(`${i + 1}.`, M, y);
        const name = `${m.name} (${m.placa})`;
        doc.text(name.length > 48 ? name.slice(0, 47) + "…" : name, M + 22, y);
        doc.text(fmtL(m.litres),                W - M - 200, y, { align: "right" });
        doc.text(m.deliveries.toLocaleString(), W - M - 110, y, { align: "right" });
        doc.setTextColor(232, 70, 30);
        doc.text(fmt$(m.ftcClaim),              W - M,       y, { align: "right" });
        doc.setTextColor(61, 43, 26);
      },
    );

    // Top projects (full list, paginated)
    drawTable(
      "Top Projects",
      [
        { header: "RANK    PROJECT", x: M },
        { header: "LITRES",          x: W - M - 200, align: "right" },
        { header: "MACHINES",        x: W - M - 110, align: "right" },
        { header: "FTC",             x: W - M,       align: "right" },
      ],
      perProject,
      (p, i) => {
        doc.text(`${i + 1}.`, M, y);
        const name = p.site ? `${p.name} — ${p.site}` : p.name;
        doc.text(name.length > 48 ? name.slice(0, 47) + "…" : name, M + 22, y);
        doc.text(fmtL(p.litres),                W - M - 200, y, { align: "right" });
        doc.text(p.machines.toLocaleString(),   W - M - 110, y, { align: "right" });
        doc.setTextColor(232, 70, 30);
        doc.text(fmt$(p.ftcClaim),              W - M,       y, { align: "right" });
        doc.setTextColor(61, 43, 26);
      },
    );

    // Comparisons — keep entire block on one page (no mid-block break).
    const drawCompare = (title: string, a: any, b: any, rows: { label: string; av: string; bv: string; aWin: boolean }[]) => {
      if (!a || !b) return;
      const blockHeight = 22 + 24 + rows.length * 18 + 14;
      ensureSpace(blockHeight);
      section(title);
      const colW2 = (W - M * 2) / 2 - 6;
      doc.setDrawColor(237, 227, 210);
      doc.roundedRect(M, y, colW2, 24 + rows.length * 18, 4, 4, "S");
      doc.roundedRect(M + colW2 + 12, y, colW2, 24 + rows.length * 18, 4, 4, "S");
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(61, 43, 26);
      doc.text(a.name || a.label, M + 8, y + 16);
      doc.text(b.name || b.label, M + colW2 + 20, y + 16);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      let ry = y + 36;
      rows.forEach((r) => {
        doc.setTextColor(139, 115, 85);
        doc.text(r.label, M + 8, ry);
        doc.text(r.label, M + colW2 + 20, ry);
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.setTextColor(r.aWin ? 15 : 61, r.aWin ? 138 : 43, r.aWin ? 94 : 26);
        doc.text(r.av, M + colW2 - 8, ry, { align: "right" });
        doc.setTextColor(!r.aWin ? 15 : 61, !r.aWin ? 138 : 43, !r.aWin ? 94 : 26);
        doc.text(r.bv, M + colW2 * 2 + 4, ry, { align: "right" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        ry += 18;
      });
      y = ry + 14;
    };

    if (perMachine.length >= 2) {
      const [a, b] = perMachine;
      drawCompare("Machinery vs Machinery — Top Two", a, b, [
        { label: "Litres",         av: fmtL(a.litres),                                              bv: fmtL(b.litres),                                              aWin: a.litres > b.litres },
        { label: "Deliveries",     av: a.deliveries.toString(),                                    bv: b.deliveries.toString(),                                    aWin: a.deliveries > b.deliveries },
        { label: "Avg / delivery", av: a.deliveries ? fmtL(a.litres / a.deliveries) : "—",         bv: b.deliveries ? fmtL(b.litres / b.deliveries) : "—",         aWin: (a.deliveries ? a.litres / a.deliveries : 0) > (b.deliveries ? b.litres / b.deliveries : 0) },
        { label: "FTC claim",      av: fmt$(a.ftcClaim),                                           bv: fmt$(b.ftcClaim),                                           aWin: a.ftcClaim > b.ftcClaim },
      ]);
    }

    if (perProject.length >= 2) {
      const [a, b] = perProject;
      drawCompare("Project vs Project — Top Two", a, b, [
        { label: "Litres",         av: fmtL(a.litres),                                              bv: fmtL(b.litres),                                              aWin: a.litres > b.litres },
        { label: "Deliveries",     av: a.deliveries.toString(),                                    bv: b.deliveries.toString(),                                    aWin: a.deliveries > b.deliveries },
        { label: "Avg / delivery", av: a.deliveries ? fmtL(a.litres / a.deliveries) : "—",         bv: b.deliveries ? fmtL(b.litres / b.deliveries) : "—",         aWin: (a.deliveries ? a.litres / a.deliveries : 0) > (b.deliveries ? b.litres / b.deliveries : 0) },
        { label: "Active plant",   av: a.machines.toString(),                                      bv: b.machines.toString(),                                      aWin: a.machines > b.machines },
        { label: "FTC claim",      av: fmt$(a.ftcClaim),                                           bv: fmt$(b.ftcClaim),                                           aWin: a.ftcClaim > b.ftcClaim },
      ]);
    }

    drawFooterAll();
    return doc;
  }

  const pdfFilename = `${companyName.replace(/[^A-Za-z0-9]+/g, "-")}-analytics-${periodLabel.replace(/\s+/g, "-")}.pdf`;

  function downloadRecap() {
    const doc = buildRecapPdf();
    doc.save(pdfFilename);
  }

  // ── Email recap state + handler ────────────────────────────────────────
  const isDemoMode = useDemo();
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [emailSubject, setEmailSubject] = useState(
    `Analytics Recap — ${companyName} · ${periodLabel}`,
  );
  const [emailMessage, setEmailMessage] = useState(
    `Hi team,\n\nAttached is the ${periodLabel.toLowerCase()} analytics recap for ${companyName}, including KPIs, machinery + project leaderboards, and head-to-head comparisons.\n\nLet us know if you'd like a deeper cut.\n\n— PACC Energy`,
  );
  const [emailSending, setEmailSending] = useState(false);

  // Keep subject in sync if the period or company changes while panel is closed.
  useEffect(() => {
    if (!emailOpen) {
      setEmailSubject(`Analytics Recap — ${companyName} · ${periodLabel}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, periodLabel]);

  async function emailRecap() {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const list = emailRecipients
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const valid = list.filter(e => emailRe.test(e));
    const invalid = list.filter(e => !emailRe.test(e));

    if (valid.length === 0) {
      toast.error("Add at least one valid recipient email.");
      return;
    }
    if (invalid.length > 0) {
      toast.error(`Invalid email${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`);
      return;
    }
    if (!emailSubject.trim()) {
      toast.error("Subject is required.");
      return;
    }

    setEmailSending(true);
    try {
      const doc = buildRecapPdf();
      // jsPDF's "datauristring" returns "data:application/pdf;filename=…;base64,XXXX"
      const dataUri = doc.output("datauristring", { filename: pdfFilename }) as string;
      const pdfBase64 = dataUri.includes(",") ? dataUri.split(",")[1] : dataUri;

      const safeMessage = emailMessage
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
      const html =
        `<div style="font-family:Inter,Arial,sans-serif;color:#1B3520;line-height:1.55;">` +
        `<div style="background:#C8F26A;height:6px;border-radius:3px;margin-bottom:20px;"></div>` +
        `<h1 style="font-size:18px;margin:0 0 12px;color:#1B3520;">Analytics Recap</h1>` +
        `<p style="margin:0 0 16px;color:#2A4A2E;font-size:13px;">${companyName} · ${periodLabel}</p>` +
        `<div style="font-size:13px;">${safeMessage}</div>` +
        `<p style="margin:24px 0 0;font-size:11px;color:#8B8773;">PDF attached: ${pdfFilename}</p>` +
        `</div>`;

      const { data, error } = await supabase.functions.invoke("send-recap-pdf", {
        body: {
          recipients: valid,
          subject: emailSubject.trim(),
          html,
          text: `${emailMessage}\n\n— PDF attached: ${pdfFilename}`,
          pdfBase64,
          pdfFilename,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

      toast.success(`Recap emailed to ${valid.length} recipient${valid.length > 1 ? "s" : ""}.`);
      setEmailOpen(false);
      setEmailRecipients("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send email";
      console.error("emailRecap failed", e);
      toast.error(msg);
    } finally {
      setEmailSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={sectionTitle}>Analytics</h2>
          <p style={{ ...muted(12), margin: "4px 0 0" }}>
            Machine-vs-machine and project-vs-project comparisons for {periodLabel.toLowerCase()}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={labelStyle}>Tracked litres</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.text }}>
              {fmtL(totalLitres)}
            </div>
          </div>
          <div>
            <div style={labelStyle}>FTC claimable</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.text }}>
              {fmt$(totalFtc)}
            </div>
          </div>
          <button
            type="button"
            onClick={downloadRecap}
            disabled={perMachine.length === 0}
            style={{
              background: T.accent, color: T.text, border: "none",
              borderRadius: 6, padding: "10px 14px", fontSize: 12, fontWeight: 600,
              cursor: perMachine.length === 0 ? "not-allowed" : "pointer",
              opacity: perMachine.length === 0 ? 0.5 : 1,
              minHeight: 44,
            }}
          >
            ↓ Download recap PDF
          </button>
          <button
            type="button"
            onClick={() => {
              if (isDemoMode) {
                toast.info("Email is disabled in demo mode. Try the download button.");
                return;
              }
              setEmailOpen(o => !o);
            }}
            disabled={perMachine.length === 0}
            title={isDemoMode ? "Disabled in demo mode" : "Email this recap to a list"}
            style={{
              background: "transparent", color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 6, padding: "10px 14px", fontSize: 12, fontWeight: 600,
              cursor: perMachine.length === 0 ? "not-allowed" : "pointer",
              opacity: perMachine.length === 0 ? 0.5 : 1,
              minHeight: 44,
            }}
          >
            ✉ Email recap
          </button>
        </div>
      </div>

      {/* Email-recap composer */}
      {emailOpen && !isDemoMode && (
        <div
          style={{
            ...card,
            borderColor: T.accent,
            display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ ...labelStyle }}>Email recap PDF</div>
            <span style={{ ...muted(11) }}>
              The PDF is generated on this device and attached to a single Gmail send.
            </span>
          </div>

          <label style={{ ...muted(11), display: "block" }}>Recipients (comma or newline separated)</label>
          <textarea
            value={emailRecipients}
            onChange={(e) => setEmailRecipients(e.target.value)}
            placeholder="ops@kellyexcavation.com, finance@metrocranes.com"
            rows={2}
            style={{
              background: T.bg, color: T.text, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit",
              resize: "vertical",
            }}
          />

          <label style={{ ...muted(11), display: "block" }}>Subject</label>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            maxLength={200}
            style={{
              background: T.bg, color: T.text, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: "8px 10px", fontSize: 13, height: 38,
            }}
          />

          <label style={{ ...muted(11), display: "block" }}>Message</label>
          <textarea
            value={emailMessage}
            onChange={(e) => setEmailMessage(e.target.value)}
            rows={5}
            style={{
              background: T.bg, color: T.text, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit",
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setEmailOpen(false)}
              disabled={emailSending}
              style={{
                background: "transparent", color: T.text,
                border: `1px solid ${T.border}`, borderRadius: 6,
                padding: "10px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                minHeight: 44,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void emailRecap()}
              disabled={emailSending || !emailRecipients.trim()}
              style={{
                background: T.accent, color: T.text, border: "none",
                borderRadius: 6, padding: "10px 14px", fontSize: 12, fontWeight: 600,
                cursor: (emailSending || !emailRecipients.trim()) ? "not-allowed" : "pointer",
                opacity: (emailSending || !emailRecipients.trim()) ? 0.6 : 1,
                minHeight: 44,
              }}
            >
              {emailSending ? "Sending…" : "Send email"}
            </button>
          </div>
        </div>
      )}

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
                  <div style={{ width: `${(m.litres / machineMaxLitres) * 100}%`, height: "100%", background: T.chart }} />
                </div>
                <span style={{ minWidth: 80, textAlign: "right", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmtL(m.litres)}
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
                  <div style={{ width: `${(p.litres / projectMaxLitres) * 100}%`, height: "100%", background: T.chart }} />
                </div>
                <span style={{ minWidth: 80, textAlign: "right", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmtL(p.litres)}
                </span>
                <span style={{ minWidth: 80, textAlign: "right", color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
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
              const chipBg   = isWinner ? "rgba(16,185,129,0.15)" : "rgba(200,242,106,0.12)";
              const chipText = isWinner ? "#C8F26A" : "#C8F26A";
              return (
                <div key={s.label} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "baseline", gap: 8 }}>
                  <div>
                    <div style={labelStyle}>{s.label}</div>
                    <div style={{
                      fontSize: 18, fontWeight: 700,
                      color: s.accent ? T.text : T.text,
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
