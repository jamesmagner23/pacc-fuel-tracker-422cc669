import { useState, useRef } from "react";
import { Upload, FileText, Loader2, TrendingUp, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTodayBuyPrices } from "@/hooks/useBuyPrices";
import { toast } from "@/hooks/use-toast";

interface Extracted {
  supplier_name?: string | null;
  invoice_date?: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  fuel_type?: string | null;
  litres?: number | null;
  price_per_litre_ex_gst?: number | null;
  price_per_litre_inc_gst?: number | null;
  delivery_fee_ex_gst?: number | null;
  subtotal_ex_gst?: number | null;
  gst_amount?: number | null;
  total_inc_gst?: number | null;
  notes?: string | null;
}

const MARGIN_TARGET_CPL = 8;

export default function CompetitorAnalyserTab() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: todayPrices = [] } = useTodayBuyPrices();
  const cheapest = todayPrices[0]; // ordered ascending

  const reset = () => {
    setFile(null);
    setExtracted(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = (f: File | null) => {
    setExtracted(null);
    setError(null);
    if (!f) return setFile(null);
    const ok = f.type === "application/pdf" || f.type.startsWith("image/");
    if (!ok) {
      toast({ title: "Unsupported file", description: "Upload a PDF or image", variant: "destructive" });
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 15MB", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const analyse = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // chunked base64 to avoid stack overflow
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const file_base64 = btoa(bin);

      const { data, error } = await supabase.functions.invoke("analyze-competitor-invoice", {
        body: { file_base64, mime_type: file.type, filename: file.name },
      });
      if (error) throw error;
      if (!data?.extracted) throw new Error("No data returned");
      setExtracted(data.extracted);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      toast({ title: "Analysis failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Margin maths
  const litres = Number(extracted?.litres ?? 0) || 0;
  const rawEx = Number(extracted?.price_per_litre_ex_gst ?? 0) || 0;
  const rawInc = Number(extracted?.price_per_litre_inc_gst ?? 0) || 0;
  // Fallbacks: derive ex from inc, or from total/litres if needed
  let compPpl = rawEx;
  if (!compPpl && rawInc) compPpl = rawInc / 1.1;
  if (!compPpl && extracted?.subtotal_ex_gst && litres) {
    compPpl = Number(extracted.subtotal_ex_gst) / litres;
  }
  if (!compPpl && extracted?.total_inc_gst && litres) {
    compPpl = Number(extracted.total_inc_gst) / 1.1 / litres;
  }
  const compTotal = Number(extracted?.total_inc_gst ?? 0) || 0;
  const ourBuyPpl = cheapest ? Number(cheapest.price_per_litre) : null;

  const marginPerLitre = ourBuyPpl != null && compPpl ? compPpl - ourBuyPpl : null;
  const marginPct = marginPerLitre != null && compPpl ? (marginPerLitre / compPpl) * 100 : null;
  const totalProfit = marginPerLitre != null && litres ? marginPerLitre * litres : null;
  const worthIt = marginPerLitre != null ? marginPerLitre * 100 >= MARGIN_TARGET_CPL : null;

  const fmt$ = (n?: number | null, d = 2) =>
    n == null || isNaN(n) ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
  const fmtCpl = (n?: number | null) =>
    n == null || isNaN(n) ? "—" : `${(n * 100).toFixed(2)}¢`;

  return (
    <div className="space-y-5">
      <div className="bg-surface border border-surface-border rounded-[10px] p-5">
        <h2 className="text-sm font-semibold mb-1">Competitor invoice analyser</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Upload a PDF or image of what a prospect is paying now. We&apos;ll extract the line items and compare to today&apos;s cheapest buy price to see if winning the account is worth it.
        </p>

        {!file ? (
          <label
            className="block border-2 border-dashed border-surface-border rounded-[10px] p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm font-medium">Drop invoice here or click to upload</div>
            <div className="text-xs text-muted-foreground mt-1">PDF or image · up to 15MB</div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between gap-3 bg-surface-raised border border-surface-border rounded-[10px] p-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={analyse}
                disabled={loading}
                className="px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5 min-h-[36px]"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                {loading ? "Analysing…" : "Analyse"}
              </button>
              <button
                onClick={reset}
                disabled={loading}
                className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground"
                aria-label="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {!cheapest && (
          <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            No buy price set for today — margin comparison will be unavailable. Add today&apos;s price in the Buy Price tab.
          </div>
        )}
        {cheapest && (
          <div className="mt-3 text-xs text-muted-foreground">
            Comparing against today&apos;s cheapest supplier: <span className="font-semibold text-foreground">{cheapest.supplier}</span> @ {fmtCpl(Number(cheapest.price_per_litre))}/L ex-GST
          </div>
        )}
        {error && (
          <div className="mt-3 text-xs text-destructive">Error: {error}</div>
        )}
      </div>

      {extracted && (
        <>
          {/* Verdict */}
          {marginPerLitre != null && (
            <div
              className="rounded-[10px] p-5 border"
              style={{
                background: worthIt ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                borderColor: worthIt ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
              }}
            >
              <div className="flex items-start gap-3">
                {worthIt ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Verdict</div>
                  <div className="text-lg font-bold">
                    {worthIt
                      ? `Worth pursuing — ${(marginPerLitre * 100).toFixed(2)}¢/L margin`
                      : `Margin too thin — only ${(marginPerLitre * 100).toFixed(2)}¢/L`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Target is ≥ {MARGIN_TARGET_CPL}¢/L ex-GST. {marginPct != null && `That's a ${marginPct.toFixed(1)}% gross margin`}
                    {totalProfit != null && ` and ~${fmt$(totalProfit)} gross profit on this drop alone.`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Margin breakdown */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-5">
            <h3 className="text-sm font-semibold mb-3">Margin breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Their price (ex GST)", value: fmtCpl(compPpl) + "/L" },
                { label: "Our buy price", value: ourBuyPpl != null ? `${fmtCpl(ourBuyPpl)}/L` : "—" },
                { label: "Margin", value: marginPerLitre != null ? `${(marginPerLitre * 100).toFixed(2)}¢/L` : "—" },
                { label: "Margin %", value: marginPct != null ? `${marginPct.toFixed(1)}%` : "—" },
                { label: "Litres on invoice", value: litres ? `${litres.toLocaleString()}L` : "—" },
                { label: "Profit on this drop", value: totalProfit != null ? fmt$(totalProfit) : "—" },
                { label: "Their invoice total (inc)", value: compTotal ? fmt$(compTotal) : "—" },
                { label: "Delivery fee (their)", value: fmt$(extracted.delivery_fee_ex_gst) },
              ].map((k) => (
                <div key={k.label} className="bg-surface-raised border border-surface-border rounded-[10px] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k.label}</div>
                  <div className="text-base font-semibold tabular-nums">{k.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Extracted details */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-5">
            <h3 className="text-sm font-semibold mb-3">Extracted from invoice</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ["Supplier", extracted.supplier_name],
                ["Invoice date", extracted.invoice_date],
                ["Customer", extracted.customer_name],
                ["Address", extracted.customer_address],
                ["Fuel type", extracted.fuel_type],
                ["Litres", extracted.litres?.toLocaleString()],
                ["Price / L (ex GST)", extracted.price_per_litre_ex_gst != null ? `${(extracted.price_per_litre_ex_gst * 100).toFixed(2)}¢` : null],
                ["Price / L (inc GST)", extracted.price_per_litre_inc_gst != null ? `${(extracted.price_per_litre_inc_gst * 100).toFixed(2)}¢` : null],
                ["Delivery fee (ex)", fmt$(extracted.delivery_fee_ex_gst)],
                ["Subtotal (ex)", fmt$(extracted.subtotal_ex_gst)],
                ["GST", fmt$(extracted.gst_amount)],
                ["Total (inc)", fmt$(extracted.total_inc_gst)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 py-1.5 border-b border-subtle">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {extracted.notes && (
              <div className="mt-4 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Notes: </span>{extracted.notes}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}