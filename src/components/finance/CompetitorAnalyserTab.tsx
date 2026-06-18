import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, TrendingUp, AlertTriangle, CheckCircle2, X, Archive, Save, Trash2, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTodayBuyPrices } from "@/hooks/useBuyPrices";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

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

interface SavedAnalysis {
  id: string;
  status: "kept" | "archived";
  filename: string | null;
  supplier_name: string | null;
  invoice_date: string | null;
  customer_name: string | null;
  litres: number | null;
  price_per_litre_ex_gst: number | null;
  our_buy_supplier: string | null;
  our_buy_price: number | null;
  our_buy_price_date: string | null;
  margin_per_litre: number | null;
  margin_pct: number | null;
  total_profit: number | null;
  created_at: string;
}

export default function CompetitorAnalyserTab() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [historicalBuy, setHistoricalBuy] = useState<{ supplier: string; price: number; date: string } | null>(null);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"kept" | "archived">("kept");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: todayPrices = [] } = useTodayBuyPrices();
  const cheapest = todayPrices[0]; // ordered ascending

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from("competitor_analyses")
      .select("id,status,filename,supplier_name,invoice_date,customer_name,litres,price_per_litre_ex_gst,our_buy_supplier,our_buy_price,our_buy_price_date,margin_per_litre,margin_pct,total_profit,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setHistory(data as SavedAnalysis[]);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const reset = () => {
    setFile(null);
    setExtracted(null);
    setError(null);
    setCurrentId(null);
    setHistoricalBuy(null);
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
    setHistoricalBuy(null);
    setCurrentId(null);
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

      // Look up historical buy price for the invoice date
      const invDate: string | undefined = data.extracted?.invoice_date;
      if (invDate) {
        const { data: bp } = await supabase
          .from("buy_prices")
          .select("supplier, price_per_litre, price_date")
          .lte("price_date", invDate)
          .order("price_date", { ascending: false })
          .order("price_per_litre", { ascending: true })
          .limit(10);
        if (bp && bp.length) {
          // pick cheapest on the most recent date <= invoice date
          const mostRecent = bp[0].price_date;
          const onDate = bp.filter((r: any) => r.price_date === mostRecent);
          onDate.sort((a: any, b: any) => Number(a.price_per_litre) - Number(b.price_per_litre));
          setHistoricalBuy({ supplier: onDate[0].supplier, price: Number(onDate[0].price_per_litre), date: onDate[0].price_date });
        }
      }
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
  // Prefer historical buy price (matching invoice date) over today's cheapest
  const ourBuyPpl = historicalBuy
    ? historicalBuy.price
    : cheapest
    ? Number(cheapest.price_per_litre)
    : null;
  const ourBuySupplier = historicalBuy?.supplier ?? cheapest?.supplier ?? null;
  const ourBuyDate = historicalBuy?.date ?? (cheapest ? format(new Date(), "yyyy-MM-dd") : null);

  const marginPerLitre = ourBuyPpl != null && compPpl ? compPpl - ourBuyPpl : null;
  const marginPct = marginPerLitre != null && compPpl ? (marginPerLitre / compPpl) * 100 : null;
  const totalProfit = marginPerLitre != null && litres ? marginPerLitre * litres : null;
  const worthIt = marginPerLitre != null ? marginPerLitre * 100 >= MARGIN_TARGET_CPL : null;

  const saveAnalysis = async (status: "kept" | "archived") => {
    if (!extracted) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const payload = {
        created_by: userRes?.user?.id ?? null,
        status,
        filename: file?.name ?? null,
        supplier_name: extracted.supplier_name ?? null,
        invoice_date: extracted.invoice_date ?? null,
        customer_name: extracted.customer_name ?? null,
        customer_address: extracted.customer_address ?? null,
        fuel_type: extracted.fuel_type ?? null,
        litres: extracted.litres ?? null,
        price_per_litre_ex_gst: compPpl || null,
        price_per_litre_inc_gst: extracted.price_per_litre_inc_gst ?? null,
        delivery_fee_ex_gst: extracted.delivery_fee_ex_gst ?? null,
        subtotal_ex_gst: extracted.subtotal_ex_gst ?? null,
        gst_amount: extracted.gst_amount ?? null,
        total_inc_gst: extracted.total_inc_gst ?? null,
        notes: extracted.notes ?? null,
        our_buy_supplier: ourBuySupplier,
        our_buy_price: ourBuyPpl,
        our_buy_price_date: ourBuyDate,
        margin_per_litre: marginPerLitre,
        margin_pct: marginPct,
        total_profit: totalProfit,
        extracted: extracted as any,
      };
      let res;
      if (currentId) {
        res = await supabase.from("competitor_analyses").update({ status }).eq("id", currentId).select().single();
      } else {
        res = await supabase.from("competitor_analyses").insert(payload).select().single();
      }
      if (res.error) throw res.error;
      setCurrentId((res.data as any).id);
      toast({ title: status === "kept" ? "Saved" : "Archived", description: status === "kept" ? "Analysis kept in your records" : "Moved to archive" });
      loadHistory();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteAnalysis = async (id: string) => {
    if (!confirm("Delete this analysis?")) return;
    const { error } = await supabase.from("competitor_analyses").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    loadHistory();
  };

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
        {!historicalBuy && cheapest && (
          <div className="mt-3 text-xs text-muted-foreground">
            Comparing against today&apos;s cheapest supplier: <span className="font-semibold text-foreground">{cheapest.supplier}</span> @ {fmtCpl(Number(cheapest.price_per_litre))}/L ex-GST
          </div>
        )}
        {historicalBuy && (
          <div className="mt-3 text-xs text-muted-foreground">
            Comparing against our buy price on <span className="font-semibold text-foreground">{historicalBuy.date}</span> — <span className="font-semibold text-foreground">{historicalBuy.supplier}</span> @ {fmtCpl(historicalBuy.price)}/L ex-GST (matched to invoice date)
          </div>
        )}
        {error && (
          <div className="mt-3 text-xs text-destructive">Error: {error}</div>
        )}
      </div>

      {extracted && (
        <>
          {/* Save / Archive actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => saveAnalysis("kept")}
              disabled={saving}
              className="px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5 min-h-[36px]"
            >
              <Save className="w-3.5 h-3.5" /> Keep
            </button>
            <button
              onClick={() => saveAnalysis("archived")}
              disabled={saving}
              className="px-3 py-2 rounded-md text-xs font-medium border border-border bg-surface-raised hover:bg-surface inline-flex items-center gap-1.5 min-h-[36px]"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
            {currentId && <span className="text-xs text-muted-foreground">Saved ✓</span>}
          </div>

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

      {/* History */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Inbox className="w-4 h-4" /> Saved analyses
          </h3>
          <div className="flex gap-1 text-xs">
            {(["kept", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setHistoryFilter(s)}
                className={`px-2.5 py-1 rounded-md border ${historyFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border bg-surface-raised text-muted-foreground hover:text-foreground"}`}
              >
                {s === "kept" ? "Kept" : "Archived"}
              </button>
            ))}
          </div>
        </div>
        {history.filter((h) => h.status === historyFilter).length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No {historyFilter} analyses yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-subtle">
                  <th className="text-left py-2 pr-3 font-medium">Saved</th>
                  <th className="text-left py-2 pr-3 font-medium">Supplier</th>
                  <th className="text-left py-2 pr-3 font-medium">Customer</th>
                  <th className="text-left py-2 pr-3 font-medium">Inv. date</th>
                  <th className="text-right py-2 pr-3 font-medium">Litres</th>
                  <th className="text-right py-2 pr-3 font-medium">Their ¢/L</th>
                  <th className="text-right py-2 pr-3 font-medium">Our ¢/L</th>
                  <th className="text-right py-2 pr-3 font-medium">Margin</th>
                  <th className="text-right py-2 pr-3 font-medium">Profit</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {history.filter((h) => h.status === historyFilter).map((h) => (
                  <tr key={h.id} className="border-b border-subtle hover:bg-surface-raised/50">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{format(new Date(h.created_at), "d MMM yy")}</td>
                    <td className="py-2 pr-3 truncate max-w-[140px]">{h.supplier_name ?? "—"}</td>
                    <td className="py-2 pr-3 truncate max-w-[160px]">{h.customer_name ?? "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{h.invoice_date ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{h.litres ? Number(h.litres).toLocaleString() : "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtCpl(h.price_per_litre_ex_gst ?? undefined)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtCpl(h.our_buy_price ?? undefined)}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${h.margin_per_litre != null && h.margin_per_litre * 100 >= MARGIN_TARGET_CPL ? "text-green-500" : "text-red-500"}`}>
                      {h.margin_per_litre != null ? `${(Number(h.margin_per_litre) * 100).toFixed(2)}¢` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{h.total_profit != null ? fmt$(Number(h.total_profit)) : "—"}</td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {h.status === "kept" ? (
                          <button
                            onClick={async () => {
                              await supabase.from("competitor_analyses").update({ status: "archived" }).eq("id", h.id);
                              loadHistory();
                            }}
                            className="p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-foreground"
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              await supabase.from("competitor_analyses").update({ status: "kept" }).eq("id", h.id);
                              loadHistory();
                            }}
                            className="p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-foreground"
                            title="Restore"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteAnalysis(h.id)}
                          className="p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}