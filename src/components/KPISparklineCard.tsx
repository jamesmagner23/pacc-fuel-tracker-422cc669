import { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

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
  /** Optional pill that replaces the delta pill entirely (e.g. "YTD"). */
  customPill?: ReactNode;
  /** Optional italic context sub-line shown directly under the pill row. */
  subLine?: string;
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
  customPill,
  subLine,
}: KPISparklineProps) {
  const showSpark = trend.length >= 2;
  const sparkValues = trend.map((t) => t.v);
  const sparkMin = sparkValues.length ? Math.min(...sparkValues) : 0;
  const sparkMax = sparkValues.length ? Math.max(...sparkValues) : 0;
  const isFlat = showSpark && sparkMax - sparkMin < 1e-6;
  // Uniform dark stroke for sparkline (per "Precision grid" direction).
  // Icon container keeps its colour tint, but the lines stay calm.
  const sparkStroke = "#0E1F10";
  const gradId = `kpi-grad-${tintColor.replace("#", "")}`;

  // ── PRECISION GRID layout ────────────────────────────────────────────
  //   • compact p-5 card, label+icon top, value+pill stacked
  //   • sparkline absolutely positioned at the bottom edge, ghosted
  //     (opacity 30 → 50 on hover) so the figure stays primary.
  const body = (
    <div className="relative h-full p-5 pb-10 group">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-tight">
          {label}
        </span>
        <div
          className="inline-flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, borderRadius: 10, background: tintBg, color: tintColor }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="relative z-10 mt-3">
        <div
          className="font-display text-[26px] leading-[1.05] font-bold tabular-nums text-foreground"
          style={{ letterSpacing: "-0.015em" }}
        >
          {value}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {customPill ? (
            customPill
          ) : deltaPct !== null ? (
            <DeltaPill pct={deltaPct} />
          ) : (
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold bg-muted text-muted-foreground"
              title="No prior period to compare against"
            >
              New
            </span>
          )}
          {subLine && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {subLine}
            </span>
          )}
        </div>
      </div>

      {/* Sparkline — absolute, ghosted, intensifies on hover */}
      <div
        className="absolute bottom-0 left-0 right-0 h-12 opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none"
        aria-hidden
      >
        {showSpark && !isFlat ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkStroke} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={sparkStroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis
                hide
                domain={[
                  sparkMin - (sparkMax - sparkMin) * 0.15,
                  sparkMax + (sparkMax - sparkMin) * 0.15,
                ]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparkStroke}
                strokeWidth={1.75}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-end px-5 pb-3">
            <div
              className="w-full"
              style={{
                height: 1,
                background: `repeating-linear-gradient(to right, ${sparkStroke}55 0 4px, transparent 4px 8px)`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );

  const wrapClass =
    "block bg-card text-foreground border border-border/60 rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
