import { useMemo, useState } from "react";
import { LayoutDashboard, Truck, Users, Route, LogOut, CalendarIcon } from "lucide-react";
import { format, subDays, startOfYear, parseISO } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { PACCLogo } from "@/components/PACCLogo";
import { GlobalThemeToggle } from "@/components/GlobalThemeToggle";
import { SyncButton } from "@/components/SyncButton";
import { supabase } from "@/integrations/supabase/client";
import { useAllTransactions } from "@/hooks/useTransactions";
import Trucks from "./Trucks";
import Customers from "./Customers";
import Dispatch from "./Dispatch";

type TabId = "overview" | "trucks" | "customers" | "dispatch";
type OpsRange = "7d" | "30d" | "90d" | "ytd" | "all" | "custom";

function OperationsOverview() {
  const [range, setRange] = useState<OpsRange>("30d");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const { data: txns = [], isLoading } = useAllTransactions();

  const filtered = useMemo(() => {
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = today;
    switch (range) {
      case "7d": start = subDays(today, 7); break;
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
    return txns.filter((t) => {
      if (!t.date) return false;
      if (startStr && t.date < startStr) return false;
      if (endStr && t.date > endStr) return false;
      return true;
    });
  }, [txns, range, customStart, customEnd]);

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const numDeliveries = filtered.length;
  const avgSize = numDeliveries > 0 ? Math.round(totalLitres / numDeliveries) : 0;
  const activeCustomers = new Set(filtered.map((t) => t.nombre_cliente1)).size;

  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => {
      if (!t.date) return;
      map[t.date] = (map[t.date] || 0) + (t.cantidad || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, l]) => ({ date: format(parseISO(d), "dd MMM"), litres: l }));
  }, [filtered]);

  const truckBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => {
      const k = t.estacion || "Unknown";
      map[k] = (map[k] || 0) + (t.cantidad || 0);
    });
    return Object.entries(map)
      .map(([name, litres]) => ({ name, litres }))
      .sort((a, b) => b.litres - a.litres);
  }, [filtered]);

  const accent = "var(--accent)";
  const muted = "var(--text-secondary)";

  const kpis = [
    { label: "Litres", value: `${totalLitres.toLocaleString()}L` },
    { label: "Deliveries", value: numDeliveries.toLocaleString() },
    { label: "Avg drop", value: `${avgSize.toLocaleString()}L` },
    { label: "Active customers", value: activeCustomers.toLocaleString() },
  ];

  return (
    <div className="space-y-5">
      {/* Local range filter */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Range</span>
        {([
          { key: "7d", label: "7d" },
          { key: "30d", label: "30d" },
          { key: "90d", label: "90d" },
          { key: "ytd", label: "YTD" },
          { key: "all", label: "All time" },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={cn(
              "px-2.5 py-1 rounded-md border transition-colors",
              range === opt.key
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
              onClick={() => setRange("custom")}
              className={cn(
                "px-2.5 py-1 rounded-md border inline-flex items-center gap-1.5 transition-colors",
                range === "custom"
                  ? "bg-primary/15 border-primary/40 text-foreground font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-card"
              )}
            >
              <CalendarIcon className="w-3 h-3" />
              {range === "custom" && customStart && customEnd
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
                if (r?.from) setRange("custom");
              }}
              numberOfMonths={2}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{k.label}</div>
            <div className="text-xl font-semibold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Litres chart */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-5">
        <h2 className="text-sm font-semibold mb-3">Litres delivered</h2>
        {isLoading ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data for this range.</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }}
                  formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]}
                />
                <Line type="monotone" dataKey="litres" stroke={accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Truck breakdown */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-5">
        <h2 className="text-sm font-semibold mb-3">Per truck</h2>
        {truckBreakdown.length === 0 ? (
          <div className="text-muted-foreground text-sm py-4">No deliveries.</div>
        ) : (
          <div className="space-y-2">
            {truckBreakdown.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm py-1.5 border-b border-subtle last:border-0">
                <span className="text-foreground">{t.name}</span>
                <span className="tabular-nums font-medium">{t.litres.toLocaleString()}L</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Operations is a standalone portal (no main admin sidebar). It mounts its
 * own slim header so operations staff get a focused workspace with just the
 * tabs they need.
 */
export default function Operations() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const tabs: { id: TabId; label: string; icon: JSX.Element }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: "trucks", label: "Trucks", icon: <Truck className="w-3.5 h-3.5" /> },
    { id: "customers", label: "Customers", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "dispatch", label: "Dispatch", icon: <Route className="w-3.5 h-3.5" /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--text-primary)" }}>
      <header
        className="sticky top-0 z-50"
        style={{
          background: "var(--background)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <PACCLogo size="sm" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
              Operations Portal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SyncButton />
            <GlobalThemeToggle compact />
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-3 sm:px-6 py-4 sm:py-6 max-w-[1200px] mx-auto">
        <div className="flex gap-1 bg-surface border border-surface-border rounded-[10px] p-1 mb-5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer min-h-[44px] sm:min-h-0 whitespace-nowrap shrink-0"
              style={{
                background: activeTab === tab.id ? "var(--accent-light)" : "transparent",
                color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                border: "none",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && <OperationsOverview />}
        {activeTab === "trucks" && <Trucks />}
        {activeTab === "customers" && <Customers />}
        {activeTab === "dispatch" && <Dispatch />}
      </main>
    </div>
  );
}