import { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Info, ChevronRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  /** Short note about the period scope (shown in tooltip). */
  periodNote?: string;
  /** Breakdown rows for the "View breakdown" popover. */
  breakdown?: Array<{ name: string; value: number; displayValue: string }>;
  /** Total for percentage calculation in breakdown. */
  breakdownTotal?: number;
  /** Title shown at the top of the breakdown popover. */
  breakdownTitle?: string;
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
  periodNote,
  breakdown,
  breakdownTotal,
  breakdownTitle = "Contributors",
}: KPISparklineProps) {
  const showSpark = trend.length >= 2;
  const sparkValues = trend.map((t) => t.v);
  const sparkMin = sparkValues.length ? Math.min(...sparkValues) : 0;
  const sparkMax = sparkValues.length ? Math.max(...sparkValues) : 0;
  const isFlat = showSpark && sparkMax - sparkMin < 1e-6;
  const sparkStroke = "#0E1F10";
  const gradId = `kpi-grad-${tintColor.replace("#", "")}`;

  const hasBreakdown = breakdown && breakdown.length > 0;
  const bTotal = breakdownTotal ?? breakdown?.reduce((s, b) => s + b.value, 0) ?? 0;

  const body = (
    <div className="relative h-full p-5 pb-10 group">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-tight truncate">
            {label}
          </span>
          {periodNote && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center shrink-0 rounded-full p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    aria-label={`Period: ${periodNote}`}
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  <p className="font-medium">{periodNote}</p>
                  <p className="text-muted-foreground mt-0.5">{fallbackContext}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
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

      {/* View breakdown link */}
      {hasBreakdown && (
        <div className="relative z-10 mt-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                View breakdown
                <ChevronRight className="w-3 h-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={6}
              className="w-64 p-0 overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-border bg-muted/40">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {breakdownTitle}
                </div>
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {breakdown.map((row) => {
                  const pct = bTotal > 0 ? (row.value / bTotal) * 100 : 0;
                  return (
                    <div
                      key={row.name}
                      className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border/50 last:border-b-0"
                    >
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {row.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[12px] font-semibold tabular-nums text-foreground">
                          {row.displayValue}
                        </span>
                        {pct > 0 && (
                          <span className="text-[11px] font-medium tabular-nums text-muted-foreground w-8 text-right">
                            {pct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {bTotal > 0 && (
                <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total
                  </span>
                  <span className="text-[12px] font-bold tabular-nums text-foreground">
                    {value}
                  </span>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}

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
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
      style={{
        background: up ? "#E6F3E1" : "#FBE5E2",
        color: up ? "#2A6A2E" : "#8C2A1F",
      }}
    >
      {formatted}
    </span>
  );
}
