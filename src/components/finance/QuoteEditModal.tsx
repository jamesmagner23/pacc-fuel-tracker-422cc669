import { useState } from "react";
import { X } from "lucide-react";
import { useUpdateQuote, type Quote } from "@/hooks/useQuotes";
import { toast } from "sonner";

const GST_RATE = 0.1;
const STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];

interface Props {
  quote: Quote;
  onClose: () => void;
}

export default function QuoteEditModal({ quote, onClose }: Props) {
  const updateQuote = useUpdateQuote();
  const [status, setStatus] = useState(quote.status);
  const [volume, setVolume] = useState(String(quote.volume_litres));
  const [notes, setNotes] = useState(quote.notes || "");
  const [validUntil, setValidUntil] = useState(quote.valid_until || "");

  const vol = parseFloat(volume) || 0;
  const sellPrice = quote.sell_price_per_litre;
  const totalExGst = sellPrice * vol;
  const totalIncGst = totalExGst * (1 + GST_RATE);

  const handleSave = async () => {
    if (vol <= 0) {
      toast.error("Volume must be greater than 0");
      return;
    }
    try {
      await updateQuote.mutateAsync({
        id: quote.id,
        status,
        volume_litres: vol,
        total_ex_gst: totalExGst,
        total_inc_gst: totalIncGst,
        notes: notes || null,
        valid_until: validUntil || null,
      });
      toast.success("Quote updated");
      onClose();
    } catch {
      toast.error("Failed to update quote");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface border border-surface-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-foreground">Edit Quote</div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-muted-foreground mb-4">
          {quote.customer_name} · ${Number(quote.sell_price_per_litre).toFixed(4)}/L
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`text-[11px] px-3 py-1.5 rounded-full border cursor-pointer transition-colors capitalize ${
                    status === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-surface-border hover:border-foreground/30"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Volume (Litres)</label>
            <input
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              type="number"
              className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Valid Until</label>
            <input
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              type="date"
              className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none resize-none"
            />
          </div>

          {vol > 0 && (
            <div className="border-t border-surface-border pt-3 mt-1">
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">Total (Ex GST)</span>
                <span className="text-foreground font-medium tabular-nums">${totalExGst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-[13px] mt-1">
                <span className="text-muted-foreground font-medium">Total (Inc GST)</span>
                <span className="text-primary font-bold tabular-nums">${totalIncGst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={updateQuote.isPending}
          className="mt-4 w-full bg-primary text-primary-foreground border-none rounded-full px-6 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-70"
        >
          {updateQuote.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
