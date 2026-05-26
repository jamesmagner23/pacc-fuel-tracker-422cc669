import { ComponentType } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export interface KPISparklineProps {
  label: string;
  value: string;
  /** Percentage change vs previous period, or null when no comparison data. */
  deltaPct: number | null;
  /** Sparse trend points (most recent last). */
  trend?: { v: number }[];
  /** Contextual line shown when deltaPct is null. */
  fallbackContext: string;
  href?: string;
  /** Lucide icon component for the tinted square. */
  icon: ComponentType<{ className?: string }>;
  /** Hex bg for the tinted icon container AND area-fill base colour. */
  tintBg: string;
  /** Hex line/icon colour. */
  tintColor: string;
}

export function KPISparklineCard({
  label,
  value,
  deltaPct,
  trend = [],
  fallbackContext,
  href,
  icon: Icon,
  tintBg,
  tintColor,
}: KPISparklineProps) {
  const showSpark = trend.length >= 2;

  const body = (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 text-[32px] leading-[1.05] font-semibold tabular-nums text-foreground" style={{ letterSpacing: "-0.01em" }}>
            {value}
          </div>
          <div className="mt-1.5">
            {deltaPct !== null ? (
              <DeltaPill pct={deltaPct} />
            ) : (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-muted text-muted-foreground"
              >
                — no comparison
              </span>
            )}
          </div>
        </div>
        <div
          className="inline-flex items-center justify-center shrink-0"
          style={{ width: 40, height: 40, borderRadius: 12, background: tintBg, color: tintColor }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {showSpark ? (
        <div style={{ height: 80 }} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`kpi-grad-${tintColor.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tintColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={tintColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={tintColor}
                strokeWidth={1.5}
                fill={`url(#kpi-grad-${tintColor.replace("#", "")})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="px-5 pb-4" style={{ height: 60 }}>
          <div className="h-full flex items-center justify-center text-center text-[12px] text-muted-foreground">
            Trend appears with 2+ data points.
          </div>
        </div>
      )}
    </div>
  );

  const wrapClass =
    "block bg-card text-foreground border border-border rounded-[14px] overflow-hidden transition-colors hover:border-[#C7CCC1] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (href) {
    return (
      <Link to={href} className={wrapClass + " cursor-pointer"}>
        {body}
      </Link>
    );
  }
  return <div className={wrapClass}>{body}</div>;
}

function DeltaPill({ pct }: { pct: number }) {
  const up = pct >= 0;
  const formatted = `${up ? "+" : "\u2212"}${Math.abs(pct).toFixed(1)}%`;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{
        background: up ? "#E6F3E1" : "#FBE5E2",
        color: up ? "#2A6A2E" : "#8C2A1F",
      }}
    >
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {formatted}
    </span>
  );
}
