import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  delay?: number;
}

export function KPICard({ title, value, change, icon, delay = 0 }: KPICardProps) {
  const isUp = change >= 0;

  return (
    <div
      className="relative overflow-hidden rounded-[12px] border border-border bg-card p-4 sm:p-5 animate-fade-in transition-all duration-300 hover:border-primary/40 hover:shadow-[0_6px_24px_-12px_hsl(var(--primary)/0.35)] hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <span className="inline-flex w-7 h-7 rounded-md bg-primary/10 text-primary items-center justify-center">
          {icon}
        </span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-foreground">{value}</div>
      <div className="flex items-center gap-1 mt-2">
        {isUp ? (
          <TrendingUp className="w-3.5 h-3.5 text-kpi-up" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-kpi-down" />
        )}
        <span className={`text-xs font-medium ${isUp ? "text-kpi-up" : "text-kpi-down"}`}>
          {isUp ? "+" : ""}
          {change.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground ml-1">vs prev period</span>
      </div>
    </div>
  );
}
