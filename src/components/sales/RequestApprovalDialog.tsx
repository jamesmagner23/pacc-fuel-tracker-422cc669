import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useCreateApprovalRequest } from "@/hooks/useQuoteApprovals";

interface Props {
  open: boolean;
  onClose: () => void;
  preset: {
    customer_name: string;
    customer_email?: string | null;
    litres: number;
    buy_price_per_litre: number;
    sell_price_per_litre: number;
    margin_pct: number;
    payment_terms_days: number | null;
    supplier?: string | null;
    breach_reasons: string[];
  };
}

export function RequestApprovalDialog({ open, onClose, preset }: Props) {
  const [note, setNote] = useState("");
  const create = useCreateApprovalRequest();
  if (!open) return null;

  const submit = async () => {
    if (!preset.customer_name) {
      toast.error("Add a customer name first");
      return;
    }
    try {
      await create.mutateAsync({
        customer_name: preset.customer_name,
        customer_email: preset.customer_email ?? null,
        litres: preset.litres,
        buy_price_per_litre: preset.buy_price_per_litre,
        sell_price_per_litre: preset.sell_price_per_litre,
        margin_pct: preset.margin_pct,
        payment_terms_days: preset.payment_terms_days,
        supplier: preset.supplier ?? null,
        driver_note: note || null,
        breach_reasons: preset.breach_reasons,
      });
      toast.success("Sent to admin for approval");
      setNote("");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit request");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Request admin approval</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-muted-foreground mb-3">
          This quote is outside the driver rules. An admin will review before it goes to the customer.
        </div>

        <div className="rounded-lg bg-muted/50 border border-border p-3 text-[12px] space-y-1 mb-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{preset.customer_name || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Litres</span><span className="tabular-nums">{preset.litres.toLocaleString()} L</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Sell (inc-GST)</span><span className="tabular-nums">${preset.sell_price_per_litre.toFixed(4)}/L</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Margin</span><span className="tabular-nums">{preset.margin_pct.toFixed(1)}%</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Payment terms</span><span className="tabular-nums">{preset.payment_terms_days == null ? "—" : preset.payment_terms_days + "d"}</span></div>
        </div>

        {preset.breach_reasons.length > 0 && (
          <ul className="text-[11px] text-amber-300 list-disc list-inside space-y-0.5 mb-3">
            {preset.breach_reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}

        <div className="mb-3">
          <label className="text-[11px] text-muted-foreground">Note for admin (why should this be approved?)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] text-foreground outline-none resize-none"
            placeholder="e.g. Repeat customer, cash on delivery, filled after hours"
          />
        </div>

        <button
          onClick={submit}
          disabled={create.isPending}
          className="w-full bg-primary text-primary-foreground border-none rounded-full px-4 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-70"
        >
          {create.isPending ? "Sending…" : "Send to admin"}
        </button>
      </div>
    </div>
  );
}