import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DateRangeToggle } from "./DateRangeToggle";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  /** Legacy subtitle line. Prefer `breadcrumb` for the new pattern. */
  subtitle?: string;
  /** Breadcrumb segments rendered below the H1. Last segment is the current page. */
  breadcrumb?: BreadcrumbSegment[];
  showPeriod?: boolean;
  /** Render a custom right-side control instead of the period toggle. */
  rightSlot?: ReactNode;
}

/**
 * Standard dashboard page header. H1 + breadcrumb on the left, period toggle on
 * the right at md+, stacked on mobile.
 */
export function PageHeader({ title, subtitle, breadcrumb, showPeriod = true, rightSlot }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] md:text-[32px] font-medium tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mt-1 flex flex-wrap items-center text-[12px] font-medium text-muted-foreground">
            {breadcrumb.map((seg, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span key={`${seg.label}-${i}`} className="inline-flex items-center">
                  {i > 0 && <span className="px-2 text-muted-foreground/60">/</span>}
                  {isLast || !seg.href ? (
                    <span className={isLast ? "text-foreground" : ""}>{seg.label}</span>
                  ) : (
                    <Link to={seg.href} className="hover:text-foreground transition-colors">
                      {seg.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        ) : subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex flex-col items-stretch md:items-end gap-1.5 md:shrink-0">
        {rightSlot ?? (showPeriod ? <DateRangeToggle /> : null)}
      </div>
    </div>
  );
}