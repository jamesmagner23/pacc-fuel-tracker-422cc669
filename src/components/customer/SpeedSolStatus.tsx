import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const T = {
  bg: "#3D2B1A",
  surface: "#4A3525",
  border: "#6B5240",
  text: "#F5E6D0",
  textSecondary: "#C4A882",
  muted: "#8B7355",
  accent: "#E8461E",
  success: "#10B981",
  warn: "#F59E0B",
  danger: "#EF4444",
  sansHead: "'Inter', system-ui, sans-serif",
};

interface Props {
  speedsolNames: string[];
  transactions: any[];
  /** ISO date strings used for the in-range count (optional). */
  fromDate?: string;
  toDate?: string;
  /** Demo mode short-circuits the live sync_log lookup. */
  isDemo?: boolean;
}

function useLastSync(enabled: boolean) {
  return useQuery({
    queryKey: ["last-sync-status"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_last_sync_status");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { synced_at: string | null; status: string | null } | null;
    },
    refetchInterval: 60_000,
  });
}

export function SpeedSolStatus({
  speedsolNames,
  transactions,
  fromDate,
  toDate,
  isDemo,
}: Props) {
  const linked = speedsolNames.length > 0;
  const { data: sync, isLoading } = useLastSync(!isDemo && linked);

  const inRangeCount = useMemo(() => {
    if (!fromDate && !toDate) return transactions.length;
    return transactions.filter((t) => {
      const d = t.date || "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    }).length;
  }, [transactions, fromDate, toDate]);

  // Status logic
  let dotColor = T.success;
  let Icon = CheckCircle2;
  let title = "Live data — connected";
  let subtitle = "All systems normal";

  if (!linked) {
    dotColor = T.warn;
    Icon = AlertTriangle;
    title = "Account not linked to SpeedSol";
    subtitle =
      "Your account hasn't been linked yet — contact your account manager to enable live deliveries.";
  } else if (isDemo) {
    dotColor = T.textSecondary;
    Icon = CheckCircle2;
    title = "Demo data";
    subtitle = "You're viewing example deliveries.";
  } else if (sync?.status && sync.status !== "success") {
    dotColor = T.danger;
    Icon = XCircle;
    title = "Last sync failed";
    subtitle = "We're aware — your account team will follow up.";
  } else if (sync?.synced_at) {
    const last = parseISO(sync.synced_at);
    const ageMs = Date.now() - last.getTime();
    const stale = ageMs > 6 * 60 * 60 * 1000; // >6h
    dotColor = stale ? T.warn : T.success;
    Icon = stale ? AlertTriangle : CheckCircle2;
    title = stale ? "Sync may be delayed" : "Live data — connected";
    subtitle = `Last synced ${formatDistanceToNow(last, { addSuffix: true })} · ${format(
      last,
      "dd MMM HH:mm"
    )}`;
  } else if (!isLoading) {
    dotColor = T.warn;
    Icon = AlertTriangle;
    title = "No sync activity yet";
    subtitle = "We haven't received a sync confirmation. Check back shortly.";
  } else {
    Icon = RefreshCw;
    title = "Checking sync status...";
    subtitle = "";
  }

  const rangeLabel =
    fromDate || toDate
      ? `${fromDate || "start"} → ${toDate || "today"}`
      : "all time";

  return (
    <div
      role="status"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: `${dotColor}22`,
            color: dotColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: T.sansHead,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
              marginBottom: 2,
            }}
          >
            SpeedSol Data Status
          </div>
          <div
            style={{
              fontSize: 14,
              fontFamily: T.sansHead,
              fontWeight: 600,
              color: T.text,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          paddingTop: 10,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <Stat
          label="Linked"
          value={linked ? "Yes" : "No"}
          tone={linked ? "ok" : "warn"}
        />
        <Stat
          label="SpeedSol Names"
          value={linked ? String(speedsolNames.length) : "—"}
        />
        <Stat
          label="Total Deliveries"
          value={transactions.length.toLocaleString()}
        />
        <Stat
          label={`In Range (${rangeLabel})`}
          value={inRangeCount.toLocaleString()}
          tone={
            linked && transactions.length > 0 && inRangeCount === 0
              ? "warn"
              : undefined
          }
        />
      </div>

      {linked && speedsolNames.length > 0 && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
          Linked names: <span style={{ color: T.textSecondary }}>{speedsolNames.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  const color = tone === "warn" ? T.warn : tone === "ok" ? T.success : T.text;
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontFamily: T.sansHead,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.muted,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontFamily: T.sansHead,
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
