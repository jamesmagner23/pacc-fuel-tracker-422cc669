import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle, Download, Settings, Table2, Bell, Archive, Trash2, Gauge, Plus, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  usePumpReadings,
  useReconAlerts,
  useReconSettings,
  useUpdateReconSettings,
  useResolveAlert,
  useDeletePumpReading,
  useAdminInsertPumpReading,
  computeDailyRecon,
  getVarianceStatus,
  type DailyReconRow,
  type ReconAlert,
  type PumpReading,
} from "@/hooks/useReconciliation";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";
import { FLEET } from "@/pages/Trucks";

type TabId = "daily" | "pump" | "alerts" | "reports" | "settings";
type TruckScope = string; // truck name or "__combined__"
const COMBINED: TruckScope = "__combined__";

const STATUS_COLORS = {
  none: "var(--positive)",
  warning: "var(--warning)",
  critical: "var(--negative)",
};

// Sign-based colors: positive variance (fuel unaccounted) = bad, negative (all delivered) = good
const varianceColor = (v: number) => v > 0 ? "var(--negative, #FF6B5E)" : v < 0 ? "var(--positive, #C8F26A)" : "var(--muted-foreground)";

const STATUS_LABELS = {
  none: "OK",
  warning: "Warning",
  critical: "Critical",
};

type RangeMode = "week" | "month" | "custom";

/** Hard cutoff — no pump data exists before this date */
const RECON_MIN_DATE = new Date(2025, 2, 16); // 16 March 2025 (months are 0-indexed)
const RECON_MIN_DATE_STR = "2025-03-16";

interface DateRangePickerProps {
  mode: RangeMode;
  onModeChange: (m: RangeMode) => void;
  startDate: Date;
  endDate: Date;
  onRangeChange: (start: Date, end: Date) => void;
}

function DateRangePicker({ mode, onModeChange, startDate, endDate, onRangeChange }: DateRangePickerProps) {
  const goBack = () => {
    if (mode === "week") {
      const prev = subWeeks(startDate, 1);
      if (prev >= RECON_MIN_DATE) onRangeChange(prev, endOfWeek(prev, { weekStartsOn: 1 }));
    } else if (mode === "month") {
      const prev = subMonths(startDate, 1);
      if (prev >= RECON_MIN_DATE) onRangeChange(startOfMonth(prev), endOfMonth(prev));
    }
  };

  const canBack = mode === "week"
    ? subWeeks(startDate, 1) >= RECON_MIN_DATE
    : mode === "month"
    ? subMonths(startDate, 1) >= RECON_MIN_DATE
    : false;
  const goForward = () => {
    if (mode === "week") {
      const next = new Date(startDate);
      next.setDate(next.getDate() + 7);
      if (next <= new Date()) onRangeChange(next, endOfWeek(next, { weekStartsOn: 1 }));
    } else if (mode === "month") {
      const next = new Date(startDate);
      next.setMonth(next.getMonth() + 1);
      if (next <= new Date()) onRangeChange(startOfMonth(next), endOfMonth(next));
    }
  };

  const canForward = mode === "week"
    ? new Date(startDate.getTime() + 7 * 86400000) <= new Date()
    : mode === "month"
    ? new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1) <= new Date()
    : false;

  const handleModeChange = (m: RangeMode) => {
    onModeChange(m);
    const now = new Date();
    if (m === "week") {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      onRangeChange(ws, endOfWeek(ws, { weekStartsOn: 1 }));
    } else if (m === "month") {
      onRangeChange(startOfMonth(now), endOfMonth(now));
    }
    // custom keeps current range
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Mode toggle */}
      <div className="flex items-center rounded-full p-0.5 gap-0.5" style={{ background: "var(--surface-raised)", border: "1px solid var(--surface-border)" }}>
        {(["week", "month", "custom"] as RangeMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border-none cursor-pointer capitalize",
              mode === m
                ? "bg-accent text-accent-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Navigation for week/month */}
      {mode !== "custom" && (
        <div className="flex items-center gap-3">
          <button onClick={goBack} disabled={!canBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
            ← Prev
          </button>
          <span className="text-sm font-medium text-foreground">
            {format(startDate, "dd MMM")} – {format(endDate, "dd MMM yyyy")}
          </span>
          <button
            onClick={goForward}
            disabled={!canForward}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* Custom date pickers */}
      {mode === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-sm text-foreground cursor-pointer">
                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                {format(startDate, "dd MMM yyyy")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => d && onRangeChange(d, endDate < d ? d : endDate)}
                disabled={(d) => d > new Date() || d < RECON_MIN_DATE}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-sm text-foreground cursor-pointer">
                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                {format(endDate, "dd MMM yyyy")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => d && onRangeChange(startDate > d ? d : startDate, d)}
                disabled={(d) => d > new Date() || d < RECON_MIN_DATE}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

function SummaryCards({ rows, settings }: { rows: DailyReconRow[]; settings: any }) {
  const totalPump = rows.reduce((s, r) => s + r.pumpLitres, 0);
  const totalSpeedsol = rows.reduce((s, r) => s + r.speedsolLitres, 0);
  const variance = totalPump - totalSpeedsol;
  const variancePct = totalPump > 0 ? (variance / totalPump) * 100 : 0;
  const status = getVarianceStatus(
    variancePct,
    variance,
    settings?.variance_threshold_pct,
    settings?.variance_threshold_litres
  );

  const statusLabel = status === "none" ? "✓ Reconciled" : status === "warning" ? "⚠ Minor Variance" : "✗ Critical Variance";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="card p-4">
        <p className="kpi-label mb-1">Total Pump Reading</p>
        <p className="text-xl font-bold text-foreground">{totalPump.toLocaleString()}L</p>
      </div>
      <div className="card p-4">
        <p className="kpi-label mb-1">Total Fuel System Delivery</p>
        <p className="text-xl font-bold text-foreground">{totalSpeedsol.toLocaleString()}L</p>
      </div>
      <div className="card p-4">
        <p className="kpi-label mb-1">Variance</p>
        <p className="text-xl font-bold" style={{ color: varianceColor(variance) }}>
          {variance >= 0 ? "+" : ""}{variance.toLocaleString()}L
        </p>
        <p className="text-xs" style={{ color: varianceColor(variance) }}>
          {variancePct >= 0 ? "+" : ""}{variancePct.toFixed(2)}%
        </p>
      </div>
      <div className="card p-4">
        <p className="kpi-label mb-1">Status</p>
        <p className="text-lg font-bold" style={{ color: STATUS_COLORS[status] }}>
          {statusLabel}
        </p>
      </div>
    </div>
  );
}

function DailyBreakdownTable({
  rows,
  pumpReadings,
  transactions,
}: {
  rows: DailyReconRow[];
  pumpReadings: PumpReading[];
  transactions: Transaction[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drillView, setDrillView] = useState<"truck" | "txn">("truck");

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Pump (L)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Fuel System (L)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Variance (L)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Variance %</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <>
                <tr
                  key={row.date}
                  onClick={() => setExpanded(expanded === row.date ? null : row.date)}
                  className="border-b border-border-subtle hover:bg-surface-raised/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{format(parseISO(row.date), "EEE dd MMM")}</td>
                  <td className="px-4 py-3 text-right text-foreground tabular-nums font-semibold">
                    {row.pumpLitres > 0 ? row.pumpLitres.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground tabular-nums font-semibold">
                    {row.speedsolLitres > 0 ? row.speedsolLitres.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: (row.pumpLitres > 0 || row.speedsolLitres > 0) ? varianceColor(row.varianceLitres) : undefined }}>
                    {row.pumpLitres > 0 || row.speedsolLitres > 0
                      ? `${row.varianceLitres >= 0 ? "+" : ""}${row.varianceLitres.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: row.pumpLitres > 0 ? varianceColor(row.variancePct) : undefined }}>
                    {row.pumpLitres > 0 ? `${row.variancePct >= 0 ? "+" : ""}${row.variancePct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: `${STATUS_COLORS[row.alertStatus]}20`,
                        color: STATUS_COLORS[row.alertStatus],
                      }}
                    >
                      {STATUS_LABELS[row.alertStatus]}
                    </span>
                  </td>
                </tr>
                {expanded === row.date && (
                  <tr key={`${row.date}-detail`}>
                    <td colSpan={6} className="px-4 py-4 bg-surface-raised/30">
                      <DayDrillDown
                        date={row.date}
                        pumpReadings={pumpReadings.filter((p) => p.reading_date === row.date)}
                        transactions={transactions.filter((t) => t.date === row.date)}
                        notes={row.driverNotes}
                        view={drillView}
                        onViewChange={setDrillView}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayDrillDown({
  date,
  pumpReadings,
  transactions,
  notes,
  view,
  onViewChange,
}: {
  date: string;
  pumpReadings: PumpReading[];
  transactions: Transaction[];
  notes: string[];
  view: "truck" | "txn";
  onViewChange: (v: "truck" | "txn") => void;
}) {
  const totalPump = pumpReadings.reduce((s, p) => s + Number(p.litres || 0), 0);
  const totalSpeed = transactions.reduce((s, t) => s + Number(t.cantidad || 0), 0);
  const variance = totalPump - totalSpeed;

  // Group by truck (pump.truck vs txn.estacion)
  const trucks = new Map<string, { pump: number; speed: number; drivers: Set<string>; placas: Set<string>; txCount: number; pumpCount: number }>();
  for (const p of pumpReadings) {
    const k = p.truck || "Unknown";
    const e = trucks.get(k) || { pump: 0, speed: 0, drivers: new Set(), placas: new Set(), txCount: 0, pumpCount: 0 };
    e.pump += Number(p.litres || 0);
    e.pumpCount += 1;
    trucks.set(k, e);
  }
  for (const t of transactions) {
    const k = t.estacion || "Unknown";
    const e = trucks.get(k) || { pump: 0, speed: 0, drivers: new Set(), placas: new Set(), txCount: 0, pumpCount: 0 };
    e.speed += Number(t.cantidad || 0);
    e.txCount += 1;
    if (t.nombre_vendedor) e.drivers.add(t.nombre_vendedor);
    if (t.placa) e.placas.add(t.placa);
    trucks.set(k, e);
  }
  const truckRows = Array.from(trucks.entries()).sort((a, b) => Math.abs(b[1].pump - b[1].speed) - Math.abs(a[1].pump - a[1].speed));

  const noData = pumpReadings.length === 0 && transactions.length === 0;

  return (
    <div className="space-y-3">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="text-muted-foreground">Pump <span className="text-foreground font-semibold tabular-nums">{totalPump.toLocaleString()}L</span></span>
          <span className="text-muted-foreground">Fuel System <span className="text-foreground font-semibold tabular-nums">{totalSpeed.toLocaleString()}L</span></span>
          <span className="text-muted-foreground">Unattributed <span className="font-semibold tabular-nums" style={{ color: varianceColor(variance) }}>{variance >= 0 ? "+" : ""}{variance.toLocaleString()}L</span></span>
        </div>
        {!noData && (
          <div className="flex gap-1 bg-surface border border-surface-border rounded-[8px] p-0.5">
            {[
              { id: "truck" as const, label: "By truck / driver" },
              { id: "txn" as const, label: "By transaction" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => onViewChange(opt.id)}
                className="px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-colors border-none cursor-pointer"
                style={{
                  background: view === opt.id ? "var(--muted)" : "transparent",
                  color: view === opt.id ? "var(--primary)" : "var(--text-secondary)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {notes.length > 0 && (
        <p className="text-xs text-muted-foreground"><strong className="text-foreground">Driver notes:</strong> {notes.join("; ")}</p>
      )}

      {noData && (
        <p className="text-xs text-muted-foreground">No pump readings or transactions recorded for this day.</p>
      )}

      {!noData && view === "truck" && (
        <div className="overflow-x-auto rounded-[8px] border border-surface-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-raised/40 text-[10px] uppercase text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Truck</th>
                <th className="text-left px-3 py-2 font-medium">Drivers</th>
                <th className="text-right px-3 py-2 font-medium">Pump (L)</th>
                <th className="text-right px-3 py-2 font-medium">Fuel System (L)</th>
                <th className="text-right px-3 py-2 font-medium">Unattributed</th>
                <th className="text-right px-3 py-2 font-medium">Fills</th>
              </tr>
            </thead>
            <tbody>
              {truckRows.map(([truck, v]) => {
                const d = v.pump - v.speed;
                return (
                  <tr key={truck} className="border-t border-border-subtle">
                    <td className="px-3 py-2 font-medium text-foreground">{truck}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.drivers.size > 0 ? Array.from(v.drivers).join(", ") : "—"}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{v.pump > 0 ? v.pump.toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{v.speed > 0 ? v.speed.toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: varianceColor(d) }}>
                      {(v.pump > 0 || v.speed > 0) ? `${d >= 0 ? "+" : ""}${d.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{v.txCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!noData && view === "txn" && (
        <div className="grid gap-3 md:grid-cols-2">
          {/* Pump readings */}
          <div className="rounded-[8px] border border-surface-border overflow-hidden">
            <div className="bg-surface-raised/40 px-3 py-2 text-[10px] uppercase text-muted-foreground font-medium flex items-center justify-between">
              <span>Pump readings</span>
              <span className="tabular-nums text-foreground">{totalPump.toLocaleString()}L</span>
            </div>
            {pumpReadings.length === 0 ? (
              <p className="px-3 py-3 text-xs text-warning">⚠ No pump reading recorded</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {pumpReadings.map((p) => (
                  <li key={p.id} className="px-3 py-2 text-xs flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{p.truck}</p>
                      {p.notes && <p className="text-muted-foreground truncate">{p.notes}</p>}
                    </div>
                    <span className="tabular-nums font-semibold text-foreground whitespace-nowrap">{Number(p.litres).toLocaleString()}L</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fuel System transactions */}
          <div className="rounded-[8px] border border-surface-border overflow-hidden">
            <div className="bg-surface-raised/40 px-3 py-2 text-[10px] uppercase text-muted-foreground font-medium flex items-center justify-between">
              <span>Fuel System transactions ({transactions.length})</span>
              <span className="tabular-nums text-foreground">{totalSpeed.toLocaleString()}L</span>
            </div>
            {transactions.length === 0 ? (
              <p className="px-3 py-3 text-xs text-warning">⚠ No transactions recorded</p>
            ) : (
              <ul className="divide-y divide-border-subtle max-h-72 overflow-y-auto">
                {transactions
                  .slice()
                  .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
                  .map((t) => (
                    <li key={t.id} className="px-3 py-2 text-xs flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground font-medium truncate">
                          {t.nombre_cliente1 || t.placa || "—"}
                        </p>
                        <p className="text-muted-foreground truncate">
                          {[t.estacion, t.nombre_vendedor, t.producto].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="tabular-nums font-semibold text-foreground whitespace-nowrap">
                        {Number(t.cantidad || 0).toLocaleString()}L
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertsTab({ alerts, onResolve }: { alerts: ReconAlert[]; onResolve: (id: string) => void }) {
  const ALERT_ICONS: Record<string, string> = {
    missing_pump: "📊",
    missing_speedsol: "📡",
    high_variance: "🔴",
    unusual_volume: "📈",
    unmatched: "⚠️",
  };

  const activeAlerts = alerts.filter((a) => a.status === "new");
  const resolvedAlerts = alerts.filter((a) => a.status === "resolved");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Active Alerts ({activeAlerts.length})</h3>
      {activeAlerts.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle className="w-8 h-8 text-positive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No active alerts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="card p-4 flex items-start gap-3">
              <span className="text-lg">{ALERT_ICONS[alert.alert_type] || "⚠️"}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground capitalize">
                  {alert.alert_type.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted-foreground">{alert.alert_date}</p>
                {alert.values && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {Object.entries(alert.values as Record<string, any>)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                )}
                {alert.suggested_action && (
                  <p className="text-xs text-accent mt-1">{alert.suggested_action}</p>
                )}
              </div>
              <button
                onClick={() => onResolve(alert.id)}
                className="text-xs px-3 py-1.5 rounded-md bg-surface-raised border border-surface-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer"
              >
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      {resolvedAlerts.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-muted-foreground mt-6">Resolved ({resolvedAlerts.length})</h3>
          <div className="space-y-2 opacity-60">
            {resolvedAlerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className="card p-3 flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-positive flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground capitalize">
                    {alert.alert_type.replace(/_/g, " ")} — {alert.alert_date}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {alert.resolved_at ? format(new Date(alert.resolved_at), "dd MMM") : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SettingsTab() {
  const { data: settings } = useReconSettings();
  const updateMutation = useUpdateReconSettings();

  if (!settings) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  const update = (field: string, value: any) => {
    updateMutation.mutate(
      { [field]: value } as any,
      { onSuccess: () => toast.success("Settings updated") }
    );
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Variance Thresholds</h3>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Variance % Threshold</label>
          <input
            type="number"
            step="0.5"
            defaultValue={settings.variance_threshold_pct}
            onBlur={(e) => update("variance_threshold_pct", parseFloat(e.target.value))}
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Variance Litres Threshold</label>
          <input
            type="number"
            defaultValue={settings.variance_threshold_litres}
            onBlur={(e) => update("variance_threshold_litres", parseFloat(e.target.value))}
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Alert Sensitivity</h3>
        <div className="flex gap-2">
          {["low", "medium", "high"].map((level) => (
            <button
              key={level}
              onClick={() => update("alert_sensitivity", level)}
              className="px-4 py-2 rounded-lg text-xs font-medium capitalize border transition-colors cursor-pointer"
              style={{
                background: settings.alert_sensitivity === level ? "var(--primary)" : "transparent",
                color: settings.alert_sensitivity === level ? "#fff" : "var(--text-secondary)",
                borderColor: settings.alert_sensitivity === level ? "var(--primary)" : "var(--surface-border)",
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Pump Calibration Factor</h3>
        <p className="text-xs text-muted-foreground">
          Apply correction to pump readings. E.g., +2 means pump reads 2% high.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            defaultValue={settings.calibration_factor}
            onBlur={(e) => update("calibration_factor", parseFloat(e.target.value))}
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2 text-sm outline-none focus:border-primary w-24"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Auto Weekly Report</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => update("auto_weekly_report", !settings.auto_weekly_report)}
            className="w-10 h-5 rounded-full transition-colors cursor-pointer border-none"
            style={{
              background: settings.auto_weekly_report ? "var(--positive)" : "var(--surface-border)",
            }}
          >
            <div
              className="w-4 h-4 rounded-full bg-white transition-transform"
              style={{
                transform: settings.auto_weekly_report ? "translateX(20px)" : "translateX(2px)",
              }}
            />
          </button>
          <span className="text-sm text-foreground">
            {settings.auto_weekly_report ? "Enabled" : "Disabled"}
          </span>
        </div>
        {settings.auto_weekly_report && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Report Email</label>
            <input
              type="email"
              defaultValue={settings.report_email || ""}
              onBlur={(e) => update("report_email", e.target.value || null)}
              placeholder="admin@pacc.energy"
              className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsTab({ weekStart }: { weekStart: Date }) {
  const handleDownloadCSV = () => {
    toast.info("CSV report generation coming soon");
  };

  return (
    <div className="space-y-4">
      <div className="card p-6 text-center">
        <Archive className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-foreground font-medium mb-2">Weekly Reports</p>
        <p className="text-xs text-muted-foreground mb-4">
          Generate a downloadable reconciliation report for the current period.
        </p>
        <button
          onClick={handleDownloadCSV}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Download className="w-4 h-4" />
          Download CSV Report
        </button>
      </div>
    </div>
  );
}

function AdminAddPumpReading({ defaultTruck }: { defaultTruck: string }) {
  const [litres, setLitres] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [truck, setTruck] = useState(defaultTruck);
  const insertMutation = useAdminInsertPumpReading();

  const handleSubmit = () => {
    if (!litres) return;
    // Admin entries use a nil UUID as driver_id since there's no specific driver
    insertMutation.mutate(
      {
        litres: parseFloat(litres),
        reading_date: date,
        driver_id: "00000000-0000-0000-0000-000000000000",
        notes: notes ? `[Admin] ${notes}` : "[Admin entry]",
        truck,
      },
      {
        onSuccess: () => {
          toast.success("Pump reading added");
          setLitres("");
          setNotes("");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Plus className="w-4 h-4 text-accent" />
        Add Pump Reading (Admin)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Truck</label>
          <select
            value={truck}
            onChange={(e) => setTruck(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          >
            {FLEET.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Litres</label>
          <input
            type="number"
            step="0.01"
            value={litres}
            onChange={(e) => setLitres(e.target.value)}
            placeholder="e.g. 4500"
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Manual correction"
            className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleSubmit}
            disabled={!litres || insertMutation.isPending}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm py-2"
          >
            {insertMutation.isPending ? "Adding…" : "Add Reading"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PumpReadingsTab({ readings, onDelete, defaultTruck }: { readings: PumpReading[]; onDelete: (id: string) => void; defaultTruck: string }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <AdminAddPumpReading defaultTruck={defaultTruck} />

      {readings.length === 0 ? (
        <div className="card p-8 text-center">
          <Gauge className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No pump readings this week</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Truck</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Litres</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Notes</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle hover:bg-surface-raised/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {format(parseISO(r.reading_date), "EEE dd MMM")}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.truck || "—"}</td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums font-semibold">
                      {Number(r.litres).toLocaleString()}L
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmId === r.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { onDelete(r.id); setConfirmId(null); }}
                            className="text-xs px-2 py-1 rounded bg-negative/20 text-negative hover:bg-negative/30 transition-colors cursor-pointer border-none"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="text-xs px-2 py-1 rounded bg-surface-raised text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-none"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(r.id)}
                          className="text-muted-foreground hover:text-negative transition-colors cursor-pointer bg-transparent border-none p-1"
                          title="Delete reading"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Reconciliation() {
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [dateStart, setDateStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dateEnd, setDateEnd] = useState(() => endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [activeTab, setActiveTab] = useState<TabId>("daily");
  const [truckScope, setTruckScope] = useState<TruckScope>(COMBINED);

  const handleRangeChange = (s: Date, e: Date) => { setDateStart(s); setDateEnd(e); };

  // Clamp to minimum recon date
  const clampedStart = dateStart < RECON_MIN_DATE ? RECON_MIN_DATE : dateStart;
  const startDate = format(clampedStart, "yyyy-MM-dd");
  const endDate = format(dateEnd, "yyyy-MM-dd");

  const { data: allPumpReadings = [] } = usePumpReadings(startDate, endDate);
  const { data: transactions = [] } = useTransactions("month"); // Get wide range
  const { data: alerts = [] } = useReconAlerts(startDate, endDate);
  const { data: settings } = useReconSettings();
  const resolveMutation = useResolveAlert();
  const deleteMutation = useDeletePumpReading();

  // Filter transactions to the selected range, then by truck scope
  const rangeTransactions = useMemo(() => {
    const inRange = transactions.filter((t) => t.date && t.date >= startDate && t.date <= endDate);
    return truckScope === COMBINED ? inRange : inRange.filter((t) => t.estacion === truckScope);
  }, [transactions, startDate, endDate, truckScope]);

  const pumpReadings = useMemo(
    () => truckScope === COMBINED ? allPumpReadings : allPumpReadings.filter((p) => p.truck === truckScope),
    [allPumpReadings, truckScope]
  );

  const dailyRows = useMemo(
    () => computeDailyRecon(pumpReadings, rangeTransactions, startDate, endDate, settings?.calibration_factor),
    [pumpReadings, rangeTransactions, startDate, endDate, settings?.calibration_factor]
  );

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "daily", label: "Daily Breakdown", icon: <Table2 className="w-3.5 h-3.5" /> },
    { id: "pump", label: `Pump Readings (${pumpReadings.length})`, icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: "alerts", label: `Alerts (${alerts.filter((a) => a.status === "new").length})`, icon: <Bell className="w-3.5 h-3.5" /> },
    { id: "reports", label: "Reports", icon: <Archive className="w-3.5 h-3.5" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-foreground">Fuel Reconciliation</h1>
        <DateRangePicker mode={rangeMode} onModeChange={setRangeMode} startDate={dateStart} endDate={dateEnd} onRangeChange={handleRangeChange} />
      </div>

      {/* Truck scope tabs */}
      <div className="flex items-center gap-1 bg-surface border border-surface-border rounded-[10px] p-1 w-fit overflow-x-auto no-scrollbar">
        {[...FLEET.map((t) => ({ id: t.name, label: t.name })), { id: COMBINED, label: "Combined" }].map((s) => (
          <button
            key={s.id}
            onClick={() => setTruckScope(s.id)}
            className="px-3 sm:px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border-none"
            style={{
              background: truckScope === s.id ? "var(--muted)" : "transparent",
              color: truckScope === s.id ? "var(--primary)" : "var(--text-secondary)",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <SummaryCards rows={dailyRows} settings={settings} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 bg-transparent cursor-pointer"
            style={{
              borderColor: activeTab === tab.id ? "var(--primary)" : "transparent",
              color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "daily" && (
        <DailyBreakdownTable rows={dailyRows} pumpReadings={pumpReadings} transactions={rangeTransactions} />
      )}
      {activeTab === "pump" && (
        <PumpReadingsTab
          readings={pumpReadings}
          defaultTruck={truckScope === COMBINED ? (FLEET[0]?.name || "PACC Truck 1") : truckScope}
          onDelete={(id) => deleteMutation.mutate(id, {
            onSuccess: () => toast.success("Pump reading deleted"),
            onError: (err) => toast.error(err.message),
          })}
        />
      )}
      {activeTab === "alerts" && (
        <AlertsTab alerts={alerts} onResolve={(id) => resolveMutation.mutate(id)} />
      )}
      {activeTab === "reports" && <ReportsTab weekStart={dateStart} />}
      {activeTab === "settings" && <SettingsTab />}
    </div>
  );
}
