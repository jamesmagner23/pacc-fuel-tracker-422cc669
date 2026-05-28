import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Check, Eraser, Loader2 } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import type { DispatchStop } from "@/hooks/useDispatch";

interface Props {
  stop: DispatchStop;
  onClose: () => void;
}

export function CompleteStopDialog({ stop, onClose }: Props) {
  const qc = useQueryClient();
  const [delivered, setDelivered] = useState<string>(
    stop.delivered_litres ? String(stop.delivered_litres) : "",
  );
  const [customerName, setCustomerName] = useState("");
  const [customerRole, setCustomerRole] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingActuals, setLoadingActuals] = useState(true);
  const [matchedTxns, setMatchedTxns] = useState<Array<{
    id: number;
    cantidad: number | null;
    producto: string | null;
    nombre_flota: string | null;
    estacion: string | null;
    placa: string | null;
    fecha: string;
  }>>([]);
  const [touchedDelivered, setTouchedDelivered] = useState(!!stop.delivered_litres);
  const custRef = useRef<SignaturePadHandle>(null);
  const drvRef = useRef<SignaturePadHandle>(null);

  // Pull actual SpeedSol transactions for this client + date + site
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingActuals(true);
      try {
        // 1) Resolve speedsol names for this client account
        const { data: acct } = await supabase
          .from("client_accounts")
          .select("speedsol_names")
          .eq("id", stop.client_account_id)
          .maybeSingle();
        const names: string[] = (acct?.speedsol_names as string[] | null) || [];
        if (!names.length) {
          if (!cancelled) setMatchedTxns([]);
          return;
        }

        // 2) Resolve project / site name to match against nombre_flota / estacion
        let projectName: string | null = null;
        if (stop.project_id) {
          const { data: proj } = await supabase
            .from("projects")
            .select("name")
            .eq("id", stop.project_id)
            .maybeSingle();
          projectName = proj?.name || null;
        }
        const siteTokens = [stop.site_name, projectName]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase().trim())
          .filter((s) => s.length > 1);

        // 3) Pull txns for this client on the scheduled date
        const { data: txns, error } = await supabase
          .from("transactions")
          .select("id, fecha, cantidad, producto, nombre_flota, estacion, placa, nombre_cliente1")
          .in("nombre_cliente1", names)
          .eq("date", stop.scheduled_date);
        if (error) throw error;

        // 4) Narrow by site match if we have tokens; otherwise keep all for that day
        const filtered = (txns || []).filter((t: any) => {
          if (!siteTokens.length) return true;
          const hay = `${t.nombre_flota || ""} ${t.estacion || ""}`.toLowerCase();
          return siteTokens.some((tok) => hay.includes(tok));
        });
        const useRows = filtered.length ? filtered : (txns || []);

        if (cancelled) return;
        setMatchedTxns(useRows as any);

        // Prefill delivered with the actual sum unless the user already edited it
        if (!touchedDelivered && !stop.delivered_litres && useRows.length) {
          const sum = useRows.reduce((a: number, t: any) => a + (Number(t.cantidad) || 0), 0);
          if (sum > 0) setDelivered(sum.toFixed(2));
        }
      } catch (e) {
        console.error("[CompleteStopDialog] actuals lookup failed", e);
      } finally {
        if (!cancelled) setLoadingActuals(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.id]);

  const actualSum = useMemo(
    () => matchedTxns.reduce((a, t) => a + (Number(t.cantidad) || 0), 0),
    [matchedTxns],
  );

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
    if (!customerRole.trim()) {
      toast.error("Enter the customer role (e.g. Site Manager)");
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
          customer_role: customerRole.trim() || null,
          customer_signature: custRef.current?.toDataURL() || null,
          driver_signature: drvRef.current?.toDataURL() || null,
          signed_at: new Date().toISOString(),
          signature_notes: notes.trim() || null,
          products: matchedTxns.length
            ? {
                source: "speedsol",
                matched_transaction_ids: matchedTxns.map((t) => t.id),
                lines: matchedTxns.map((t) => ({
                  txn_id: t.id,
                  product: t.producto,
                  litres: Number(t.cantidad) || 0,
                  placa: t.placa,
                  fleet: t.nombre_flota,
                  station: t.estacion,
                })),
                total_litres: actualSum,
              }
            : null,
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
          {/* Actuals panel */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Actual deliveries (SpeedSol)
              </div>
              {loadingActuals && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            </div>
            {!loadingActuals && matchedTxns.length === 0 && (
              <div className="text-xs text-gray-600">
                No SpeedSol transactions found for this client on {stop.scheduled_date}. Enter litres manually.
              </div>
            )}
            {matchedTxns.length > 0 && (
              <>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {matchedTxns.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className="truncate mr-2">
                        {t.producto || "Fuel"}
                        {t.placa ? ` · ${t.placa}` : ""}
                        {t.nombre_flota ? ` · ${t.nombre_flota}` : ""}
                      </span>
                      <span className="font-mono font-semibold tabular-nums">
                        {(Number(t.cantidad) || 0).toFixed(2)} L
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 text-xs font-semibold">
                  <span>Total from dockets</span>
                  <span className="font-mono tabular-nums">{actualSum.toFixed(2)} L</span>
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Delivered litres {matchedTxns.length > 0 && <span className="text-gray-400 font-normal normal-case">(prefilled from SpeedSol)</span>}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={delivered}
              onChange={(e) => { setDelivered(e.target.value); setTouchedDelivered(true); }}
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