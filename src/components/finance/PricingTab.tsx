import { useState, useMemo, useRef, useEffect } from "react";
import { format, parseISO, addDays } from "date-fns";
import { Send, Trash2, FileText, Plus, Settings2, Download, ChevronDown, Pencil, Copy, CheckSquare, Square, X } from "lucide-react";
import jsPDF from "jspdf";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import {
  usePricingTiers,
  useUpsertTier,
  useDeleteTier,
  useQuotes,
  useCreateQuote,
  useDeleteQuote,
  useUpdateQuoteStatus,
  getTierForVolume,
  type PricingTier,
  type Quote,
} from "@/hooks/useQuotes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import QuoteEditModal from "./QuoteEditModal";

const GST_RATE = 0.1;

interface LineItem {
  key: string;
  volume: string;
  margin: string;
  description: string;
}

const newLineItem = (): LineItem => ({
  key: crypto.randomUUID(),
  volume: "",
  margin: "",
  description: "",
});

export default function PricingTab() {
  const queryClient = useQueryClient();
  const { data: buyPrices = [] } = useBuyPrices(30);
  const { data: tiers = [], isLoading: tiersLoading } = usePricingTiers();
  const { data: quotes = [], isLoading: quotesLoading } = useQuotes();
  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_accounts").select("id, company_name, contact_email, contact_name, contact_phone").eq("is_active", true).order("company_name");
      if (error) throw error;
      return data || [];
    },
  });
  const createQuote = useCreateQuote();
  const deleteQuote = useDeleteQuote();
  const upsertTier = useUpsertTier();
  const deleteTier = useDeleteTier();
  const updateQuoteStatus = useUpdateQuoteStatus();

  const latestBuyPrice = buyPrices[0]?.price_per_litre || 0;

  const [showTierConfig, setShowTierConfig] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState("7");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("sent");

  // Multi-line items
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);

  const updateLine = (key: string, field: keyof LineItem, value: string) => {
    setLineItems((items) => items.map((li) => li.key === key ? { ...li, [field]: value } : li));
  };
  const removeLine = (key: string) => {
    setLineItems((items) => items.length > 1 ? items.filter((li) => li.key !== key) : items);
  };
  const addLine = () => setLineItems((items) => [...items, newLineItem()]);

  // Calculate per-line and totals
  const lineCalcs = useMemo(() => {
    return lineItems.map((li) => {
      const vol = parseFloat(li.volume) || 0;
      const margin = parseFloat(li.margin);
      const marginPct = !isNaN(margin) ? margin : 0;
      const sellPrice = latestBuyPrice > 0 ? latestBuyPrice * (1 + marginPct / 100) : 0;
      const totalEx = sellPrice * vol;
      return { vol, marginPct, sellPrice, totalEx };
    });
  }, [lineItems, latestBuyPrice, tiers]);

  const grandTotalEx = lineCalcs.reduce((s, c) => s + c.totalEx, 0);
  const grandTotalInc = grandTotalEx * (1 + GST_RATE);
  const grandVolume = lineCalcs.reduce((s, c) => s + c.vol, 0);
  const weightedMargin = grandTotalEx > 0
    ? lineCalcs.reduce((s, c) => s + c.marginPct * c.totalEx, 0) / grandTotalEx
    : 0;

  const filteredQuotes = useMemo(
    () => quotes.filter(q =>
      (statusFilter === "all" || q.status === statusFilter) &&
      (!quoteSearch || q.customer_name.toLowerCase().includes(quoteSearch.toLowerCase()))
    ),
    [quotes, statusFilter, quoteSearch]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filteredQuotes.length ? new Set() : new Set(filteredQuotes.map(q => q.id)));
  };

  const handleBulkStatusChange = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id =>
        updateQuoteStatus.mutateAsync({ id, status: bulkStatus, ...(bulkStatus === "sent" ? { sent_at: new Date().toISOString() } : {}) })
      ));
      toast.success(`${selectedIds.size} quote(s) updated`);
      setSelectedIds(new Set());
    } catch { toast.error("Failed to update quotes"); }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteQuote.mutateAsync(id)));
      toast.success(`${selectedIds.size} quote(s) deleted`);
      setSelectedIds(new Set());
    } catch { toast.error("Failed to delete quotes"); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowClientDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredClients = clients.filter((c) =>
    c.company_name.toLowerCase().includes((clientSearch || name).toLowerCase())
  );
  const isExistingClient = clients.some((c) => c.company_name.toLowerCase() === name.toLowerCase());

  const selectClient = (client: typeof clients[0]) => {
    setName(client.company_name);
    setEmail(client.contact_email || "");
    setPhone(client.contact_phone || "");
    setShowClientDropdown(false);
    setClientSearch("");
  };

  const handleSaveNewClient = async () => {
    if (!name || !email) { toast.error("Name and email required"); return; }
    try {
      const { error } = await supabase.from("client_accounts").insert({ company_name: name, contact_email: email, contact_phone: phone || null });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["client-accounts"] });
      toast.success("Client saved");
    } catch { toast.error("Failed to save client"); }
  };

  // Tier editing
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editTierName, setEditTierName] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editMax, setEditMax] = useState("");
  const [editMargin, setEditMargin] = useState("");

  const handleEditTier = (t: PricingTier) => {
    setEditingTierId(t.id); setEditTierName(t.tier_name); setEditMin(String(t.min_litres));
    setEditMax(t.max_litres ? String(t.max_litres) : ""); setEditMargin(String(t.margin_percent)); setShowTierConfig(true);
  };
  const resetTierForm = () => { setEditingTierId(null); setEditTierName(""); setEditMin(""); setEditMax(""); setEditMargin(""); };

  const handleAddTier = async () => {
    const min = parseFloat(editMin); const margin = parseFloat(editMargin);
    if (!editTierName || isNaN(min) || isNaN(margin)) { toast.error("Fill in all tier fields"); return; }
    try {
      await upsertTier.mutateAsync({ ...(editingTierId ? { id: editingTierId } : {}), tier_name: editTierName, min_litres: min, max_litres: editMax ? parseFloat(editMax) : null, margin_percent: margin });
      toast.success(editingTierId ? "Tier updated" : "Tier saved");
      resetTierForm();
    } catch { toast.error("Failed to save tier"); }
  };

  const handleCreateQuote = async () => {
    if (!name || !email || grandVolume <= 0 || latestBuyPrice <= 0) {
      toast.error("Fill in customer, at least one line item with volume, and ensure a buy price is set");
      return;
    }
    // Validate all line items have margin
    for (let i = 0; i < lineItems.length; i++) {
      const vol = parseFloat(lineItems[i].volume);
      const margin = parseFloat(lineItems[i].margin);
      if (!vol || vol <= 0) { toast.error(`Line ${i + 1}: enter a volume`); return; }
      if (isNaN(margin)) { toast.error(`Line ${i + 1}: enter a margin %`); return; }
    }

    const lineItemsData = lineItems.map((li, i) => ({
      volume: parseFloat(li.volume) || 0,
      margin_percent: lineCalcs[i].marginPct,
      sell_price: lineCalcs[i].sellPrice,
      total_ex: lineCalcs[i].totalEx,
      description: li.description || null,
    }));

    // Use weighted average for the quote record
    const avgSellPrice = grandVolume > 0 ? grandTotalEx / grandVolume : 0;

    try {
      await createQuote.mutateAsync({
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        volume_litres: grandVolume,
        buy_price_per_litre: latestBuyPrice,
        margin_percent: Math.round(weightedMargin * 10) / 10,
        sell_price_per_litre: avgSellPrice,
        total_ex_gst: grandTotalEx,
        total_inc_gst: grandTotalInc,
        notes: notes || null,
        valid_until: format(addDays(new Date(), parseInt(validDays) || 7), "yyyy-MM-dd"),
        line_items: lineItemsData,
      } as any);
      toast.success("Quote created");
      setName(""); setEmail(""); setPhone(""); setNotes("");
      setLineItems([newLineItem()]);
    } catch { toast.error("Failed to create quote"); }
  };

  const generateQuotePdf = (q: Quote) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = w - margin * 2;
    let y = 0;

    // Header — brand dark brown with cream/orange
    doc.setFillColor(61, 43, 26); // #3D2B1A
    doc.rect(0, 0, w, 42, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(245, 230, 208); // cream
    doc.text("PACC", margin, 26);
    const paccW = doc.getTextWidth("PACC");
    doc.setTextColor(232, 70, 30); doc.setFontSize(14); // accent orange
    doc.text("®", margin + paccW + 1, 22);
    doc.setFontSize(7); doc.setTextColor(196, 168, 130); // text-secondary
    doc.text("FUEL", margin, 33);

    // Accent bar under header
    doc.setFillColor(232, 70, 30);
    doc.rect(0, 42, w, 1.5, "F");

    y = 58;
    doc.setTextColor(17, 17, 17); doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text("Fuel Quote", margin, y);
    y += 10;
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(102, 102, 102);
    doc.text("Prepared for ", margin, y);
    const prepW = doc.getTextWidth("Prepared for ");
    doc.setFont("helvetica", "bold"); doc.setTextColor(17, 17, 17);
    doc.text(q.customer_name, margin + prepW, y);
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(102, 102, 102); doc.setFontSize(9);
    doc.text(format(parseISO(q.created_at), "dd MMMM yyyy"), margin, y);

    // Line items table
    const items: any[] = (q as any).line_items || [];
    y += 14;

    if (items.length > 1) {
      // Multi-line quote
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(102, 102, 102);
      doc.text("Item", margin, y + 4);
      doc.text("Volume", margin + 60, y + 4);
      doc.text("Price/L", margin + 95, y + 4);
      doc.text("Total (Ex GST)", margin + contentW, y + 4, { align: "right" });
      y += 8;
      doc.setDrawColor(238, 238, 238); doc.line(margin, y, margin + contentW, y);
      y += 4;

      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      items.forEach((item: any, i: number) => {
        doc.setTextColor(17, 17, 17);
        doc.text(item.description || `Line ${i + 1}`, margin, y + 4);
        doc.text(`${Number(item.volume).toLocaleString()}L`, margin + 60, y + 4);
        doc.text(`$${Number(item.sell_price).toFixed(4)}`, margin + 95, y + 4);
        doc.setFont("helvetica", "bold");
        doc.text(`$${Number(item.total_ex).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, margin + contentW, y + 4, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 10;
        doc.setDrawColor(238, 238, 238); doc.line(margin, y - 2, margin + contentW, y - 2);
      });
      y += 2;
    } else {
      // Single line — clean format without duplication
      const rows = [
        ["Volume", `${Number(q.volume_litres).toLocaleString()} Litres`],
        ["Price Per Litre (Ex GST)", `$${Number(q.sell_price_per_litre).toFixed(4)}`],
      ];
      doc.setFontSize(10);
      for (const [label, value] of rows) {
        doc.setDrawColor(238, 238, 238); doc.line(margin, y + 7, margin + contentW, y + 7);
        doc.setFont("helvetica", "normal"); doc.setTextColor(102, 102, 102); doc.text(label, margin, y + 4);
        doc.setFont("helvetica", "bold"); doc.setTextColor(17, 17, 17); doc.text(value, margin + contentW, y + 4, { align: "right" });
        y += 12;
      }
    }

    // Subtotal + GST + Total
    y += 2;
    doc.setDrawColor(238, 238, 238); doc.line(margin, y, margin + contentW, y);
    y += 4;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(102, 102, 102);
    doc.text("Subtotal (Ex GST)", margin, y + 4);
    doc.setFont("helvetica", "bold"); doc.setTextColor(17, 17, 17);
    doc.text(`$${Number(q.total_ex_gst).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, margin + contentW, y + 4, { align: "right" });
    y += 10;
    doc.setFont("helvetica", "normal"); doc.setTextColor(102, 102, 102);
    doc.text("GST (10%)", margin, y + 4);
    doc.setFont("helvetica", "bold"); doc.setTextColor(17, 17, 17);
    doc.text(`$${(Number(q.total_inc_gst) - Number(q.total_ex_gst)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, margin + contentW, y + 4, { align: "right" });

    y += 14;
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(17, 17, 17);
    doc.text("Total (Inc GST)", margin, y + 4);
    doc.setTextColor(232, 70, 30); doc.setFontSize(16); // accent orange
    doc.text(`$${Number(q.total_inc_gst).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, margin + contentW, y + 4, { align: "right" });

    if (q.notes) {
      y += 18;
      doc.setFillColor(249, 249, 249); doc.roundedRect(margin, y - 4, contentW, 16, 3, 3, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(102, 102, 102);
      doc.text(q.notes, margin + 6, y + 4, { maxWidth: contentW - 12 });
      y += 16;
    }

    // Validity & Melbourne metro
    if (q.valid_until) {
      y += 10; doc.setFontSize(8); doc.setTextColor(153, 153, 153);
      doc.text(`This quote is valid until ${format(parseISO(q.valid_until), "dd MMMM yyyy")}. Valid for Melbourne Metro delivery only.`, margin, y);
    }

    // Tagline & portal info
    y += 14;
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(232, 70, 30);
    doc.text("You Ring, We Bring.", margin, y);
    y += 7;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 120);
    const portalLines = [
      "As a PACC Fuel customer, you'll have access to our live Customer Portal — track your",
      "machines, plant, and tank data updated in real time. Log in at paccenergy.com/portal.",
    ];
    portalLines.forEach((line) => { doc.text(line, margin, y); y += 4.5; });

    y += 10; doc.setFontSize(8); doc.setTextColor(187, 187, 187);
    doc.text("PACC Fuel · Melbourne, Australia", margin, y);
    doc.save(`PACC-Quote-${q.customer_name.replace(/\s+/g, "-")}-${format(parseISO(q.created_at), "yyyyMMdd")}.pdf`);
  };

  const handleDuplicateQuote = (q: Quote) => {
    setName(q.customer_name); setEmail(q.customer_email); setPhone(q.customer_phone || ""); setNotes(q.notes || "");
    const items: any[] = (q as any).line_items || [];
    if (items.length > 0) {
      setLineItems(items.map((li: any) => ({ key: crypto.randomUUID(), volume: String(li.volume), margin: String(li.margin_percent), description: li.description || "" })));
    } else {
      setLineItems([{ key: crypto.randomUUID(), volume: String(q.volume_litres), margin: String(q.margin_percent), description: "" }]);
    }
    toast.info("Quote duplicated — edit and create a new one");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSendQuote = async (quoteId: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-quote", { body: { quote_id: quoteId } });
      if (error) throw error;
      toast.success("Quote emailed");
    } catch { toast.error("Failed to send quote"); }
  };

  const inputClass = "bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full";
  const smInput = "bg-[hsl(var(--muted))] border border-surface-border rounded-md text-foreground px-2 py-1.5 text-[11px] outline-none w-full tabular-nums";

  return (
    <div className="flex flex-col gap-4">
      {/* Buy price */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Today's Buy Price (Base)</div>
        <div className="text-2xl sm:text-3xl font-light text-foreground tracking-tighter tabular-nums">
          {latestBuyPrice > 0 ? `$${latestBuyPrice.toFixed(4)}` : "—"}
          <span className="text-sm text-muted-foreground">/L</span>
        </div>
      </div>

      {/* Default tiers (collapsed) */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Default Volume Tiers</div>
          <button onClick={() => setShowTierConfig(!showTierConfig)} className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer p-1">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {!showTierConfig && !tiersLoading && (
          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => (
              <div key={t.id} className="text-[10px] text-muted-foreground bg-[hsl(var(--muted))] rounded-md px-2.5 py-1.5">
                {t.tier_name}: {t.min_litres.toLocaleString()}L{t.max_litres ? `–${t.max_litres.toLocaleString()}L` : "+"} → +{t.margin_percent}%
                {latestBuyPrice > 0 && ` ($${(latestBuyPrice * (1 + t.margin_percent / 100)).toFixed(4)})`}
              </div>
            ))}
            {tiers.length === 0 && <div className="text-[11px] text-muted-foreground">No default tiers set. Margins will be entered manually per line.</div>}
          </div>
        )}
        {showTierConfig && (
          <div className="border-t border-surface-border pt-3 mt-1">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Manage Tiers</div>
            {tiers.map((t) => (
              <div key={t.id} className={`flex items-center justify-between py-1.5 text-[12px] text-foreground rounded px-1 ${editingTierId === t.id ? "bg-primary/10" : ""}`}>
                <span>{t.tier_name} — {t.min_litres.toLocaleString()}L{t.max_litres ? `–${t.max_litres.toLocaleString()}L` : "+"} @ {t.margin_percent}%</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEditTier(t)} className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer p-1"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => deleteTier.mutate(t.id)} className="bg-transparent border-none text-muted-foreground hover:text-destructive cursor-pointer p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <input placeholder="Tier name" value={editTierName} onChange={(e) => setEditTierName(e.target.value)} className={inputClass + " sm:!w-28"} />
              <input placeholder="Min L" type="number" value={editMin} onChange={(e) => setEditMin(e.target.value)} className={inputClass + " sm:!w-20"} />
              <input placeholder="Max L" type="number" value={editMax} onChange={(e) => setEditMax(e.target.value)} className={inputClass + " sm:!w-20"} />
              <input placeholder="Margin %" type="number" value={editMargin} onChange={(e) => setEditMargin(e.target.value)} className={inputClass + " sm:!w-20"} />
              <div className="flex gap-1.5">
                <button onClick={handleAddTier} className="bg-primary text-primary-foreground border-none rounded-full px-4 py-2 text-[11px] font-semibold cursor-pointer whitespace-nowrap">
                  {editingTierId ? "Update" : "Add"}
                </button>
                {editingTierId && <button onClick={resetTierForm} className="bg-transparent text-muted-foreground border border-surface-border rounded-full px-3 py-2 text-[11px] cursor-pointer">Cancel</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quote builder with line items */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3.5">Create Quote</div>

        {/* Customer details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 relative" ref={dropdownRef}>
            <label className="text-[11px] text-muted-foreground">Customer Name *</label>
            <div className="relative">
              <input value={name} onChange={(e) => { setName(e.target.value); setShowClientDropdown(true); }} onFocus={() => setShowClientDropdown(true)} placeholder="Search or type new…" className={inputClass + " pr-8"} />
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {showClientDropdown && filteredClients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                {filteredClients.map((c) => (
                  <button key={c.id} onClick={() => selectClient(c)} className="w-full text-left px-3 py-2 bg-transparent border-none cursor-pointer hover:bg-muted transition-colors">
                    <div className="text-[13px] text-foreground font-medium">{c.company_name}</div>
                    <div className="text-[10px] text-muted-foreground">{c.contact_email}{c.contact_phone ? ` · ${c.contact_phone}` : ""}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Email *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="customer@email.com" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Valid For (Days)</label>
            <input value={validDays} onChange={(e) => setValidDays(e.target.value)} type="number" className={inputClass} />
          </div>
        </div>

        {name.length > 1 && email && !isExistingClient && (
          <button onClick={handleSaveNewClient} className="mt-3 text-[11px] text-primary hover:text-primary/80 bg-transparent border border-primary/20 rounded-full px-4 py-1.5 cursor-pointer transition-colors">
            + Save "{name}" as new client
          </button>
        )}

        {/* Line items table */}
        <div className="mt-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Line Items</div>
          <div className="bg-[hsl(var(--muted))] rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="px-2 py-2 font-medium w-8">#</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium">Volume (L)</th>
                  <th className="px-2 py-2 font-medium">Margin %</th>
                  {latestBuyPrice > 0 && <th className="px-2 py-2 font-medium">Sell $/L</th>}
                  {latestBuyPrice > 0 && <th className="px-2 py-2 font-medium">Total Ex GST</th>}
                  <th className="px-2 py-2 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, i) => {
                  const calc = lineCalcs[i];
                  return (
                    <tr key={li.key} className="border-t border-border/50">
                      <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-2">
                        <input value={li.description} onChange={(e) => updateLine(li.key, "description", e.target.value)} placeholder="e.g. Diesel" className={smInput} />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={li.volume} onChange={(e) => updateLine(li.key, "volume", e.target.value)} placeholder="Litres" className={smInput} />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" step="0.5" value={li.margin} onChange={(e) => updateLine(li.key, "margin", e.target.value)} placeholder="e.g. 8" className={smInput} />
                      </td>
                      {latestBuyPrice > 0 && (
                        <td className="px-2 py-2 text-foreground tabular-nums whitespace-nowrap">
                          {calc.sellPrice > 0 ? `$${calc.sellPrice.toFixed(4)}` : "—"}
                        </td>
                      )}
                      {latestBuyPrice > 0 && (
                        <td className="px-2 py-2 text-foreground tabular-nums font-medium whitespace-nowrap">
                          {calc.totalEx > 0 ? `$${calc.totalEx.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                        </td>
                      )}
                      <td className="px-2 py-2">
                        {lineItems.length > 1 && (
                          <button onClick={() => removeLine(li.key)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button onClick={addLine} className="mt-2 text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 bg-transparent border-none cursor-pointer">
            <Plus className="w-3 h-3" /> Add line item
          </button>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5 mt-3">
          <label className="text-[11px] text-muted-foreground">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inputClass} />
        </div>

        {/* Totals preview */}
        {grandVolume > 0 && latestBuyPrice > 0 && (
          <div className="mt-4 border-t border-surface-border pt-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quote Totals</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground">Total Volume</div>
                <div className="text-sm font-medium text-foreground tabular-nums">{grandVolume.toLocaleString()} L</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Avg Margin</div>
                <div className="text-sm font-medium text-foreground tabular-nums">{weightedMargin.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Total (Ex GST)</div>
                <div className="text-lg font-semibold text-foreground tabular-nums">${grandTotalEx.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Total (Inc GST)</div>
                <div className="text-xl font-bold text-primary tabular-nums">${grandTotalInc.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleCreateQuote} disabled={createQuote.isPending} className="mt-4 bg-primary text-primary-foreground border-none rounded-full px-6 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-70">
          {createQuote.isPending ? "Creating…" : `Create Quote (${lineItems.length} item${lineItems.length !== 1 ? "s" : ""})`}
        </button>
      </div>

      {/* Quote history */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Quotes ({filteredQuotes.length})</div>
            <input value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)} placeholder="Search customer…" className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-2.5 py-1 text-[11px] outline-none w-36" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {["all", "draft", "sent", "accepted", "rejected", "expired"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`text-[10px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors capitalize ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-surface-border hover:border-foreground/30"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {quotesLoading ? (
          <div className="text-muted-foreground text-[13px]">Loading…</div>
        ) : quotes.length === 0 ? (
          <div className="text-muted-foreground text-[13px]">No quotes yet.</div>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-[11px] text-foreground font-medium">{selectedIds.size} selected</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-2 py-1 text-[11px] outline-none">
                    {["draft", "sent", "accepted", "rejected", "expired"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={handleBulkStatusChange} className="bg-primary text-primary-foreground border-none rounded-full px-3 py-1 text-[10px] font-semibold cursor-pointer">Set Status</button>
                  <button onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground border-none rounded-full px-3 py-1 text-[10px] font-semibold cursor-pointer">Delete</button>
                </div>
              </div>
            )}
            {filteredQuotes.length > 0 && (
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer mb-1 p-0 transition-colors">
                {selectedIds.size === filteredQuotes.length ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                {selectedIds.size === filteredQuotes.length ? "Deselect all" : "Select all"}
              </button>
            )}
            <div className="flex flex-col">
              {filteredQuotes.map((q, i, arr) => {
                const items: any[] = (q as any).line_items || [];
                return (
                  <div key={q.id} className="flex items-center justify-between py-3" style={{ borderBottom: i < arr.length - 1 ? "1px solid hsl(var(--border))" : "none" }}>
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <button onClick={() => toggleSelect(q.id)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-0 mt-0.5 flex-shrink-0 transition-colors">
                        {selectedIds.has(q.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-foreground truncate">{q.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {items.length > 1 ? `${items.length} items · ` : ""}{q.volume_litres.toLocaleString()}L · ${q.sell_price_per_litre.toFixed(4)}/L · {format(parseISO(q.created_at), "dd MMM yyyy")}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${q.status === "sent" ? "bg-primary/10 text-primary" : q.status === "draft" ? "bg-muted text-muted-foreground" : "bg-muted text-foreground"}`}>
                            {q.status}
                          </span>
                          {q.valid_until && <span className="text-[10px] text-muted-foreground">Valid until {format(parseISO(q.valid_until), "dd MMM")}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <div className="text-right mr-2">
                        <div className="text-sm font-semibold text-foreground tabular-nums">${q.total_inc_gst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div className="text-[10px] text-muted-foreground">inc GST</div>
                      </div>
                      <button onClick={() => setEditingQuote(q)} title="Edit" className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1.5 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDuplicateQuote(q)} title="Duplicate" className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1.5 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                      <button onClick={() => generateQuotePdf(q)} title="PDF" className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1.5 transition-colors"><Download className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleSendQuote(q.id)} title="Email" className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-primary p-1.5 transition-colors"><Send className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteQuote.mutate(q.id)} title="Delete" className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1.5 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {editingQuote && <QuoteEditModal quote={editingQuote} onClose={() => setEditingQuote(null)} />}
    </div>
  );
}
