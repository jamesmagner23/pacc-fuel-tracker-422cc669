import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SpeedSolValue — renders a read-only value sourced from SpeedSol.
 *
 * UI lock convention: any litres / prices / totals that originate from the
 * SpeedSol SCA WEB sync MUST be displayed through this component (or carry
 * the `data-speedsol-locked` attribute). It renders as plain text with a
 * small lock affordance and a tooltip explaining the value cannot be edited
 * or re-sourced from the UI — SpeedSol is the single source of truth.
 *
 * Never wrap this in an <input>, <textarea>, or contentEditable element.
 */
export function SpeedSolValue({
  children,
  className,
  showIcon = true,
  title = "Sourced from SpeedSol — source of truth. This value cannot be edited or re-sourced from the UI.",
}: {
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
  title?: string;
}) {
  return (
    <span
      data-speedsol-locked="true"
      title={title}
      aria-readonly="true"
      className={cn("inline-flex items-center gap-1 tabular-nums", className)}
    >
      <span className="select-text">{children}</span>
      {showIcon && (
        <Lock
          className="w-3 h-3 text-muted-foreground/70 shrink-0"
          aria-label="Locked — sourced from SpeedSol"
        />
      )}
    </span>
  );
}

export default SpeedSolValue;