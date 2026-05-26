import { ReactNode } from "react";
import { DateRangeToggle } from "./DateRangeToggle";
import { useSyncLog } from "@/hooks/useTransactions";
import { formatTime } from "@/lib/format";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showPeriod?: boolean;
  /** Render a custom right-side control instead of the period toggle. */
  rightSlot?: ReactNode;
}

/**
 * Standard dashboard page header. H1 + subtitle on the left, period toggle on
 * the right at md+, stacked on mobile. A subtle "Updated 1:46pm" label sits
 * under the period toggle when sync data is available.
 */
export function PageHeader({ title, subtitle, showPeriod = true, rightSlot }: PageHeaderProps) {
  const { data: lastSync } = useSyncLog();
  const updatedLabel = lastSync?.synced_at ? `Updated ${formatTime(lastSync.synced_at)}` : null;

  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] md:text-[32px] font-medium tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-col items-stretch md:items-end gap-1.5 md:shrink-0">
        {rightSlot ?? (showPeriod ? <DateRangeToggle /> : null)}
        {updatedLabel && (
          <span className="text-[11px] text-muted-foreground self-end">{updatedLabel}</span>
        )}
      </div>
    </div>
  );
}