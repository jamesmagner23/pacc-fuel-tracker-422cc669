import type { PricingResult } from "@/lib/transactionPricing";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
export function TransactionPrice({ pricing, total = false }: { pricing: PricingResult; total?: boolean }) {
  const value = total ? pricing.total : pricing.sellPPL;
  if (value == null) return <span className="text-warning bg-muted px-1.5 py-0.5 rounded text-[11px]">Rate missing</span>;
  return <span className="tabular-nums">${value.toLocaleString("en-AU", { minimumFractionDigits: total ? 2 : 4, maximumFractionDigits: total ? 2 : 4 })}{pricing.source === "calculated" && <Tooltip><TooltipTrigger asChild><span tabIndex={0} className="ml-1 text-[9px] text-muted-foreground">calc.</span></TooltipTrigger><TooltipContent>Calculated from Client Pricing using the buy price effective on the delivery date. All prices inc GST. Latest available price is used only if no earlier price exists.</TooltipContent></Tooltip>}</span>;
}