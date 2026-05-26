import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

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
}

export function KPISparklineCard({
  label,
  value,
  deltaPct,
  trend = [],
  fallbackContext,
  href,
}: KPISparklineProps) {
  const showSpark = trend.length >= 2;
  const lastValue = showSpark ? trend[trend.length - 1].v : null;

  const body = (
    <div className="flex items-start justify-between gap-4 h-full">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-[32px] leading-none font-medium tabular-nums text-foreground">
          {value}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {deltaPct !== null ? (
            <>
              <DeltaPill pct={deltaPct} />
              <span>vs previous period</span>
            </>
          ) : (
            <span className="text-[12px] text-muted-foreground">{fallbackContext}</span>
          )}
        </div>
      </div>
      {showSpark && (
        <div className="hidden xs:block shrink-0 mt-1" style={{ width: 64, height: 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke="hsl(var(--foreground))"
                strokeWidth={1.5}
                dot={(props: any) => {
                  if (props.index !== trend.length - 1) return null as any;
                  return (
                    <circle
                      key="last"
                      cx={props.cx}
                      cy={props.cy}
                      r={3}
                      fill="hsl(var(--accent))"
                      stroke="none"
                    />
                  );
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  const wrapClass =
    "block bg-card text-foreground border border-border rounded-xl p-5 transition-colors hover:border-[#C7CCC1] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{
        background: up ? "#E6F3E1" : "#FBE5E2",
        color: up ? "#2A6A2E" : "#8C2A1F",
      }}
    >
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}
