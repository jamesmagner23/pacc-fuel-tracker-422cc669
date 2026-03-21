import { useState, useMemo, useRef, useEffect } from "react";
import { format, parseISO, addDays } from "date-fns";
import { Send, Trash2, FileText, Plus, Settings2, Download, ChevronDown } from "lucide-react";
import jsPDF from "jspdf";
import { useQuery } from "@tanstack/react-query";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import {
  usePricingTiers,
  useUpsertTier,
  useDeleteTier,
  useQuotes,
  useCreateQuote,
  useDeleteQuote,
  getTierForVolume,
  type PricingTier,
  type Quote,
} from "@/hooks/useQuotes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const GST_RATE = 0.1;

export default function PricingTab() {
  const { data: buyPrices = [] } = useBuyPrices(30);
  const { data: tiers = [], isLoading: tiersLoading } = usePricingTiers();
  const { data: quotes = [], isLoading: quotesLoading } = useQuotes();
  const createQuote = useCreateQuote();
  const deleteQuote = useDeleteQuote();
  const upsertTier = useUpsertTier();
  const deleteTier = useDeleteTier();

  const latestBuyPrice = buyPrices[0]?.price_per_litre || 0;

  const [showTierConfig, setShowTierConfig] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [volume, setVolume] = useState("");
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState("7");

  // Tier editing
  const [editTierName, setEditTierName] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editMax, setEditMax] = useState("");
  const [editMargin, setEditMargin] = useState("");

  const vol = parseFloat(volume) || 0;
  const matchedTier = useMemo(() => getTierForVolume(tiers, vol), [tiers, vol]);
  const marginPct = matchedTier?.margin_percent ?? 10;
  const sellPrice = latestBuyPrice > 0 ? latestBuyPrice * (1 + marginPct / 100) : 0;
  const totalExGst = sellPrice * vol;
  const totalIncGst = totalExGst * (1 + GST_RATE);

  const handleCreateQuote = async () => {
    if (!name || !email || vol <= 0 || latestBuyPrice <= 0) {
      toast.error("Fill in customer name, email, volume, and ensure a buy price is set");
      return;
    }
    try {
      await createQuote.mutateAsync({
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        volume_litres: vol,
        buy_price_per_litre: latestBuyPrice,
        margin_percent: marginPct,
        sell_price_per_litre: sellPrice,
        total_ex_gst: totalExGst,
        total_inc_gst: totalIncGst,
        notes: notes || null,
        valid_until: format(addDays(new Date(), parseInt(validDays) || 7), "yyyy-MM-dd"),
      });
      toast.success("Quote created");
      setName("");
      setEmail("");
      setPhone("");
      setVolume("");
      setNotes("");
    } catch {
      toast.error("Failed to create quote");
    }
  };

  const generateQuotePdf = (q: Quote) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = w - margin * 2;
    let y = 0;

    // Header bar
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, w, 42, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("PACC", margin, 26);
    const paccW = doc.getTextWidth("PACC");
    doc.setTextColor(124, 58, 237);
    doc.setFontSize(14);
    doc.text("®", margin + paccW + 1, 22);
    doc.setFontSize(7);
    doc.setTextColor(102, 102, 102);
    doc.text("FUEL", margin, 33);

    // Quote title
    y = 58;
    doc.setTextColor(17, 17, 17);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Fuel Quote", margin, y);

    y += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(102, 102, 102);
    doc.text(`Prepared for `, margin, y);
    const prepW = doc.getTextWidth("Prepared for ");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 17, 17);
    doc.text(q.customer_name, margin + prepW, y);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(102, 102, 102);
    doc.setFontSize(9);
    doc.text(format(parseISO(q.created_at), "dd MMMM yyyy"), margin, y);

    // Table
    y += 14;
    const rows = [
      ["Volume", `${Number(q.volume_litres).toLocaleString()} Litres`],
      ["Price Per Litre (Ex GST)", `$${Number(q.sell_price_per_litre).toFixed(4)}`],
      ["Total (Ex GST)", `$${Number(q.total_ex_gst).toLocaleString(undefined, { maximumFractionDigits: 2 })}`],
      ["GST (10%)", `$${(Number(q.total_inc_gst) - Number(q.total_ex_gst)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`],
    ];

    doc.setFontSize(10);
    for (const [label, value] of rows) {
      doc.setDrawColor(238, 238, 238);
      doc.line(margin, y + 7, margin + contentW, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(102, 102, 102);
      doc.text(label, margin, y + 4);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 17, 17);
      doc.text(value, margin + contentW, y + 4, { align: "right" });
      y += 12;
    }

    // Total row
    y += 4;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 17, 17);
    doc.text("Total (Inc GST)", margin, y + 4);
    doc.setTextColor(124, 58, 237);
    doc.setFontSize(16);
    doc.text(
      `$${Number(q.total_inc_gst).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      margin + contentW, y + 4, { align: "right" }
    );

    // Notes
    if (q.notes) {
      y += 18;
      doc.setFillColor(249, 249, 249);
      doc.roundedRect(margin, y - 4, contentW, 16, 3, 3, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(102, 102, 102);
      doc.text(q.notes, margin + 6, y + 4, { maxWidth: contentW - 12 });
      y += 16;
    }

    // Valid until
    if (q.valid_until) {
      y += 10;
      doc.setFontSize(8);
      doc.setTextColor(153, 153, 153);
      doc.text(`This quote is valid until ${format(parseISO(q.valid_until), "dd MMMM yyyy")}.`, margin, y);
    }

    // Footer
    y += 18;
    doc.setFontSize(8);
    doc.setTextColor(187, 187, 187);
    doc.text("PACC Fuel · Melbourne, Australia", margin, y);

    doc.save(`PACC-Quote-${q.customer_name.replace(/\s+/g, "-")}-${format(parseISO(q.created_at), "yyyyMMdd")}.pdf`);
  };

  const handleSendQuote = async (quoteId: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-quote", { body: { quote_id: quoteId } });
      if (error) throw error;
      toast.success("Quote emailed successfully");
    } catch {
      toast.error("Failed to send quote email");
    }
  };

  const handleAddTier = async () => {
    const min = parseFloat(editMin);
    const margin = parseFloat(editMargin);
    if (!editTierName || isNaN(min) || isNaN(margin)) {
      toast.error("Fill in tier name, min litres and margin %");
      return;
    }
    try {
      await upsertTier.mutateAsync({
        tier_name: editTierName,
        min_litres: min,
        max_litres: editMax ? parseFloat(editMax) : null,
        margin_percent: margin,
      });
      toast.success("Tier saved");
      setEditTierName("");
      setEditMin("");
      setEditMax("");
      setEditMargin("");
    } catch {
      toast.error("Failed to save tier");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Today's base price */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
          Today's Buy Price (Base)
        </div>
        <div className="text-2xl sm:text-3xl font-light text-foreground tracking-tighter tabular-nums">
          {latestBuyPrice > 0 ? `$${latestBuyPrice.toFixed(4)}` : "—"}
          <span className="text-sm text-muted-foreground">/L</span>
        </div>
      </div>

      {/* Volume tiers */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Volume Pricing Tiers
          </div>
          <button
            onClick={() => setShowTierConfig(!showTierConfig)}
            className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer p-1"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {tiersLoading ? (
          <div className="text-muted-foreground text-[13px]">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {tiers.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg border p-3 ${
                  matchedTier?.id === t.id
                    ? "border-primary bg-primary/5"
                    : "border-surface-border"
                }`}
              >
                <div className="text-[11px] font-medium text-foreground">{t.tier_name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {t.min_litres.toLocaleString()}L{t.max_litres ? ` – ${t.max_litres.toLocaleString()}L` : "+"}
                </div>
                <div className="text-lg font-semibold text-foreground mt-1 tabular-nums">
                  +{t.margin_percent}%
                </div>
                {latestBuyPrice > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    ≈ ${(latestBuyPrice * (1 + t.margin_percent / 100)).toFixed(4)}/L
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tier config */}
        {showTierConfig && (
          <div className="mt-4 border-t border-surface-border pt-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
              Manage Tiers
            </div>
            {tiers.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-1.5 text-[12px] text-foreground">
                <span>{t.tier_name} — {t.min_litres}L{t.max_litres ? `–${t.max_litres}L` : "+"} @ {t.margin_percent}%</span>
                <button onClick={() => deleteTier.mutate(t.id)} className="bg-transparent border-none text-muted-foreground hover:text-destructive cursor-pointer p-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <input placeholder="Tier name" value={editTierName} onChange={(e) => setEditTierName(e.target.value)} className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full sm:w-28" />
              <input placeholder="Min L" type="number" value={editMin} onChange={(e) => setEditMin(e.target.value)} className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full sm:w-20" />
              <input placeholder="Max L" type="number" value={editMax} onChange={(e) => setEditMax(e.target.value)} className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full sm:w-20" />
              <input placeholder="Margin %" type="number" value={editMargin} onChange={(e) => setEditMargin(e.target.value)} className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full sm:w-20" />
              <button onClick={handleAddTier} className="bg-primary text-primary-foreground border-none rounded-full px-4 py-2 text-[11px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quote builder */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3.5">
          Create Quote
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Customer Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ABC Transport" className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Email *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="customer@email.com" className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Volume (Litres) *</label>
            <input value={volume} onChange={(e) => setVolume(e.target.value)} type="number" placeholder="e.g. 8000" className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Valid For (Days)</label>
            <input value={validDays} onChange={(e) => setValidDays(e.target.value)} type="number" className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
          </div>
        </div>

        {/* Live preview */}
        {vol > 0 && latestBuyPrice > 0 && (
          <div className="mt-4 border-t border-surface-border pt-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quote Preview</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground">Tier</div>
                <div className="text-sm font-medium text-foreground">{matchedTier?.tier_name || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Margin</div>
                <div className="text-sm font-medium text-foreground">{marginPct}%</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Sell Price</div>
                <div className="text-sm font-medium text-foreground tabular-nums">${sellPrice.toFixed(4)}/L</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Buy Price</div>
                <div className="text-sm font-medium text-muted-foreground tabular-nums">${latestBuyPrice.toFixed(4)}/L</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Total (Ex GST)</div>
                <div className="text-lg font-semibold text-foreground tabular-nums">${totalExGst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">GST</div>
                <div className="text-sm font-medium text-foreground tabular-nums">${(totalExGst * GST_RATE).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-muted-foreground">Total (Inc GST)</div>
                <div className="text-xl font-bold text-primary tabular-nums">${totalIncGst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleCreateQuote}
          disabled={createQuote.isPending}
          className="mt-4 bg-primary text-primary-foreground border-none rounded-full px-6 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-70"
        >
          {createQuote.isPending ? "Creating…" : "Create Quote"}
        </button>
      </div>

      {/* Quote history */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3.5">
          Quotes ({quotes.length})
        </div>
        {quotesLoading ? (
          <div className="text-muted-foreground text-[13px]">Loading…</div>
        ) : quotes.length === 0 ? (
          <div className="text-muted-foreground text-[13px]">No quotes yet. Create your first one above.</div>
        ) : (
          <div className="flex flex-col">
            {quotes.map((q, i) => (
              <div key={q.id} className="flex items-center justify-between py-3" style={{ borderBottom: i < quotes.length - 1 ? "1px solid hsl(var(--border))" : "none" }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground truncate">{q.customer_name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {q.volume_litres.toLocaleString()}L · ${q.sell_price_per_litre.toFixed(4)}/L · {format(parseISO(q.created_at), "dd MMM yyyy")}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      q.status === "sent" ? "bg-primary/10 text-primary" : q.status === "draft" ? "bg-muted text-muted-foreground" : "bg-muted text-foreground"
                    }`}>
                      {q.status}
                    </span>
                    {q.valid_until && (
                      <span className="text-[10px] text-muted-foreground">
                        Valid until {format(parseISO(q.valid_until), "dd MMM")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <div className="text-right mr-2">
                    <div className="text-sm font-semibold text-foreground tabular-nums">${q.total_inc_gst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-muted-foreground">inc GST</div>
                  </div>
                  <button
                    onClick={() => generateQuotePdf(q)}
                    title="Download PDF"
                    className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleSendQuote(q.id)}
                    title="Email quote"
                    className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-primary p-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteQuote.mutate(q.id)}
                    title="Delete quote"
                    className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
