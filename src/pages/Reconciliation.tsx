import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle, Download, Settings, Table2, Bell, Archive } from "lucide-react";
import { toast } from "sonner";
import {
  usePumpReadings,
  useReconAlerts,
  useReconSettings,
  useUpdateReconSettings,
  useResolveAlert,
  computeDailyRecon,
  getVarianceStatus,
  type DailyReconRow,
  type ReconAlert,
} from "@/hooks/useReconciliation";
import { useTransactions } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";

type TabId = "daily" | "alerts" | "reports" | "settings";

const STATUS_COLORS = {
  none: "var(--positive)",
  warning: "var(--warning)",
  critical: "var(--negative)",
};

const STATUS_LABELS = {
  none: "OK",
  warning: "Warning",
  critical: "Critical",
};

function WeekPicker({ weekStart, onChange }: { weekStart: Date; onChange: (d: Date) => void }) {
  const goBack = () => onChange(subWeeks(weekStart, 1));
  const goForward = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    if (next <= new Date()) onChange(next);
  };
  const canForward = new Date(weekStart.getTime() + 7 * 86400000) <= new Date();

  return (
    <div className="flex items-center gap-3">
      <button onClick={goBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer">
        ← Prev
      </button>
      <span className="text-sm font-medium text-foreground">
        {format(weekStart, "dd MMM")} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), "dd MMM yyyy")}
      </span>
      <button
        onClick={goForward}
        disabled={!canForward}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Next →
      </button>
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
        <p className="kpi-label mb-1">Total SpeedSol Delivery</p>
        <p className="text-xl font-bold text-foreground">{totalSpeedsol.toLocaleString()}L</p>
      </div>
      <div className="card p-4">
        <p className="kpi-label mb-1">Variance</p>
        <p className="text-xl font-bold" style={{ color: STATUS_COLORS[status] }}>
          {variance >= 0 ? "+" : ""}{variance.toLocaleString()}L
        </p>
        <p className="text-xs" style={{ color: STATUS_COLORS[status] }}>
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

function DailyBreakdownTable({ rows }: { rows: DailyReconRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Pump (L)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">SpeedSol (L)</th>
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
                  <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: STATUS_COLORS[row.alertStatus] }}>
                    {row.pumpLitres > 0 || row.speedsolLitres > 0
                      ? `${row.varianceLitres >= 0 ? "+" : ""}${row.varianceLitres.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: STATUS_COLORS[row.alertStatus] }}>
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
                    <td colSpan={6} className="px-4 py-3 bg-surface-raised/30">
                      <div className="text-xs text-muted-foreground space-y-1">
                        {row.driverNotes.length > 0 && (
                          <p><strong>Notes:</strong> {row.driverNotes.join("; ")}</p>
                        )}
                        {row.pumpLitres === 0 && row.speedsolLitres > 0 && (
                          <p className="text-warning">⚠ Missing pump reading for this day</p>
                        )}
                        {row.speedsolLitres === 0 && row.pumpLitres > 0 && (
                          <p className="text-warning">⚠ No SpeedSol transactions recorded</p>
                        )}
                        {row.pumpLitres === 0 && row.speedsolLitres === 0 && (
                          <p>No data recorded for this day</p>
                        )}
                      </div>
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
                background: settings.alert_sensitivity === level ? "var(--accent)" : "transparent",
                color: settings.alert_sensitivity === level ? "#fff" : "var(--text-secondary)",
                borderColor: settings.alert_sensitivity === level ? "var(--accent)" : "var(--surface-border)",
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

export default function Reconciliation() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [activeTab, setActiveTab] = useState<TabId>("daily");

  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(endOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: pumpReadings = [] } = usePumpReadings(startDate, endDate);
  const { data: transactions = [] } = useTransactions("month"); // Get wide range
  const { data: alerts = [] } = useReconAlerts(startDate, endDate);
  const { data: settings } = useReconSettings();
  const resolveMutation = useResolveAlert();

  // Filter transactions to the selected week
  const weekTransactions = useMemo(
    () => transactions.filter((t) => t.date && t.date >= startDate && t.date <= endDate),
    [transactions, startDate, endDate]
  );

  const dailyRows = useMemo(
    () => computeDailyRecon(pumpReadings, weekTransactions, startDate, endDate, settings?.calibration_factor),
    [pumpReadings, weekTransactions, startDate, endDate, settings?.calibration_factor]
  );

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "daily", label: "Daily Breakdown", icon: <Table2 className="w-3.5 h-3.5" /> },
    { id: "alerts", label: `Alerts (${alerts.filter((a) => a.status === "new").length})`, icon: <Bell className="w-3.5 h-3.5" /> },
    { id: "reports", label: "Reports", icon: <Archive className="w-3.5 h-3.5" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Fuel Reconciliation</h1>
        <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
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
              borderColor: activeTab === tab.id ? "var(--accent)" : "transparent",
              color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "daily" && <DailyBreakdownTable rows={dailyRows} />}
      {activeTab === "alerts" && (
        <AlertsTab alerts={alerts} onResolve={(id) => resolveMutation.mutate(id)} />
      )}
      {activeTab === "reports" && <ReportsTab weekStart={weekStart} />}
      {activeTab === "settings" && <SettingsTab />}
    </div>
  );
}
