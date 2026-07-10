import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import type { PriceStatus } from "@/lib/pricing";

export function PriceStatusBanner({ status }: { status: PriceStatus }) {
  const colour =
    status.level === "green" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
    : status.level === "amber" ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
    : status.level === "blocked" ? "border-slate-500/50 bg-slate-500/10 text-slate-100"
    : "border-red-500/50 bg-red-500/10 text-red-100";
  const Icon = status.level === "green" ? CheckCircle2
    : status.level === "amber" ? AlertTriangle
    : status.level === "blocked" ? ShieldAlert
    : XCircle;
  const label = status.level === "green" ? "OK to quote"
    : status.level === "amber" ? "Confirm before sending"
    : status.level === "blocked" ? "Blocked — approval required"
    : "Below floor";
  return (
    <div className={`rounded-lg border p-3 text-xs flex gap-2 ${colour}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-semibold mb-0.5">{label}</div>
        <div className="opacity-90">{status.message}</div>
        <div className="opacity-70 mt-1">
          Tier: {status.tier.label} · target {status.tier.targetGpPct}% GP · floor {status.floorPct.toFixed(0)}% GP
        </div>
      </div>
    </div>
  );
}
