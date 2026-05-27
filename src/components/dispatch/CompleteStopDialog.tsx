import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Check, Eraser } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import type { DispatchStop } from "@/hooks/useDispatch";

interface Props {
  stop: DispatchStop;
  onClose: () => void;
}

export function CompleteStopDialog({ stop, onClose }: Props) {
  const qc = useQueryClient();
  const [delivered, setDelivered] = useState<string>(
    stop.delivered_litres ? String(stop.delivered_litres) : stop.estimated_litres ? String(stop.estimated_litres) : "",
  );
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const custRef = useRef<SignaturePadHandle>(null);
  const drvRef = useRef<SignaturePadHandle>(null);

  const submit = async () => {
    const litres = parseFloat(delivered);
    if (!litres || litres <= 0) {
      toast.error("Enter the delivered litres");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Enter the customer / site rep name");
      return;
    }
    if (custRef.current?.isEmpty()) {
      toast.error("Customer signature is required");
      return;
    }
    if (drvRef.current?.isEmpty()) {
      toast.error("Driver signature is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("dispatch_stops" as any)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          delivered_litres: litres,
          customer_name: customerName.trim(),
          customer_signature: custRef.current?.toDataURL() || null,
          driver_signature: drvRef.current?.toDataURL() || null,
          signed_at: new Date().toISOString(),
          signature_notes: notes.trim() || null,
        })
        .eq("id", stop.id);
      if (error) throw error;
      toast.success("Docket signed & stop completed");
      qc.invalidateQueries({ queryKey: ["dispatch-stops"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to save docket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(14,31,16,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "#0E1F10" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Sign Docket</div>
            <div className="text-base font-semibold">{stop.site_name}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100" style={{ border: "none", background: "transparent" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Delivered litres</label>
            <input
              type="number"
              inputMode="decimal"
              value={delivered}
              onChange={(e) => setDelivered(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-3 text-base outline-none focus:border-gray-900"
              placeholder="e.g. 4500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Site rep / customer name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-3 text-base outline-none focus:border-gray-900"
              placeholder="Full name"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer signature</label>
              <button
                type="button"
                onClick={() => custRef.current?.clear()}
                className="text-[11px] text-gray-500 flex items-center gap-1"
                style={{ background: "none", border: "none" }}
              >
                <Eraser className="w-3 h-3" /> Clear
              </button>
            </div>
            <SignaturePad ref={custRef} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Driver signature</label>
              <button
                type="button"
                onClick={() => drvRef.current?.clear()}
                className="text-[11px] text-gray-500 flex items-center gap-1"
                style={{ background: "none", border: "none" }}
              >
                <Eraser className="w-3 h-3" /> Clear
              </button>
            </div>
            <SignaturePad ref={drvRef} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">On-site notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-900"
              placeholder="Tank condition, access notes, anything to flag…"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 sticky bottom-0 bg-white flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-gray-300 text-sm font-semibold"
            style={{ background: "white", color: "#0E1F10" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "#2A6A2E", color: "white", border: "none" }}
          >
            <Check className="w-4 h-4" /> {saving ? "Saving…" : "Complete & Sign"}
          </button>
        </div>
      </div>
    </div>
  );
}