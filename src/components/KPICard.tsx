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
      className="glass-card p-4 sm:p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
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
