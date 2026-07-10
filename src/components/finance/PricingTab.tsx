import { useState, useMemo, useRef, useEffect } from "react";
import { format, parseISO, addDays } from "date-fns";
import { Send, Trash2, FileText, Plus, Settings2, Download, ChevronDown, Pencil, Copy, CheckSquare, Square, X } from "lucide-react";
import jsPDF from "jspdf";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuyPrices, useTodayBuyPrice, useTodayBuyPrices } from "@/hooks/useBuyPrices";
import { useTodayTGP } from "@/hooks/useTGPrices";
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
import { useDemo } from "@/hooks/useDemo";
import { DEMO_CLIENT_ACCOUNTS } from "@/data/demoData";
import OutreachComposer from "@/components/outreach/OutreachComposer";
import { Mail } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { checkDriverBreaches, DRIVER_RULES } from "@/hooks/useQuoteApprovals";
import { DriverGuardrailBanner } from "@/components/sales/DriverGuardrailBanner";

const GST_RATE = 0.1;

const PRODUCT_TYPES = ["Diesel", "AdBlue", "Grease", "Tank", "Pump", "Equipment", "Other"] as const;
type ProductType = typeof PRODUCT_TYPES[number];
const FUEL_TYPES: ProductType[] = ["Diesel"];

interface LineItem {
  key: string;
  productType: ProductType;
  volume: string;
  margin: string;
  unitPrice: string;
  quantity: string;
  description: string;
}

const isFuelType = (t: ProductType) => FUEL_TYPES.includes(t);

const newLineItem = (): LineItem => ({
  key: crypto.randomUUID(),
  productType: "Diesel",
  volume: "",
  margin: "",
  unitPrice: "",
  quantity: "1",
  description: "",
});

export default function PricingTab() {
  const isDemo = useDemo();
  const queryClient = useQueryClient();
  const { data: role } = useUserRole();
  const isDriver = role === "driver";
  const { data: buyPrices = [] } = useBuyPrices(30);
  const { data: todayPricesAll = [] } = useTodayBuyPrices();
  const { data: todayBuyPrice } = useTodayBuyPrice();
  const TGP_LOCATIONS = ["Melbourne", "Sydney", "Brisbane", "Adelaide", "Perth", "Darwin", "Hobart"] as const;
  const TGP_PRODUCTS = ["Diesel", "ULP"] as const;
  const [tgpLocation, setTgpLocation] = useState<string>("Melbourne");
  const [tgpProduct, setTgpProduct] = useState<string>("Diesel");
  const { data: todayTGP } = useTodayTGP(tgpLocation, tgpProduct);
  const { data: tiers = [], isLoading: tiersLoading } = usePricingTiers();
  const { data: quotes = [], isLoading: quotesLoading } = useQuotes();
  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts", isDemo],
    queryFn: async () => {
      if (isDemo) {
        return DEMO_CLIENT_ACCOUNTS.map((c) => ({
          id: c.id,
          company_name: c.company_name,
          contact_email: c.contact_email,
          contact_name: c.contact_name,
          contact_phone: c.contact_phone,
        }));
      }
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

  // Supplier picker — defaults to today's cheapest supplier
  const sortedToday = useMemo(
    () => [...todayPricesAll].sort((a, b) => a.price_per_litre - b.price_per_litre),
    [todayPricesAll]
  );
  const cheapestToday = sortedToday[0] || null;
  const dearestToday = sortedToday[sortedToday.length - 1] || null;
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedSupplier && cheapestToday) setSelectedSupplier(cheapestToday.supplier);
  }, [cheapestToday, selectedSupplier]);
  const selectedTodayPrice = sortedToday.find(p => p.supplier === selectedSupplier) || cheapestToday || todayBuyPrice;
  const latestBuyPrice = selectedTodayPrice?.price_per_litre || todayBuyPrice?.price_per_litre || 0;
  const hasTodayPrice = sortedToday.length > 0 || !!todayBuyPrice;
  const supplierDelta = cheapestToday && dearestToday && cheapestToday.id !== dearestToday.id
    ? dearestToday.price_per_litre - cheapestToday.price_per_litre
    : null;

  const [showTierConfig, setShowTierConfig] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  
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

  const [composerOpen, setComposerOpen] = useState(false);

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
      const fuel = isFuelType(li.productType);
      if (fuel) {
        const vol = parseFloat(li.volume) || 0;
        const margin = parseFloat(li.margin);
        const marginPct = !isNaN(margin) ? margin : 0;
        const sellPrice = latestBuyPrice > 0 ? latestBuyPrice * (1 + marginPct / 100) : 0;
        const totalEx = sellPrice * vol;
        return { vol, marginPct, sellPrice, totalEx, fuel };
      } else {
        const qty = parseFloat(li.quantity) || 0;
        const unitPrice = parseFloat(li.unitPrice) || 0;
        const totalEx = unitPrice * qty;
        return { vol: qty, marginPct: 0, sellPrice: unitPrice, totalEx, fuel };
      }
    });
  }, [lineItems, latestBuyPrice]);

  const grandTotalEx = lineCalcs.reduce((s, c) => s + c.totalEx, 0);
  const grandTotalInc = grandTotalEx * (1 + GST_RATE);
  const grandVolume = lineCalcs.reduce((s, c) => s + c.vol, 0);
  const hasFuelItems = lineItems.some(li => isFuelType(li.productType));
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
    if (hasFuelItems && !hasTodayPrice) {
      toast.error("Today's buy price has not been entered yet — go to Buy Price tab first");
      return;
    }
    if (!name || !email || grandTotalEx <= 0) {
      toast.error("Fill in customer and at least one line item");
      return;
    }
    // Validate all line items
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      const fuel = isFuelType(li.productType);
      if (fuel) {
        const vol = parseFloat(li.volume);
        const margin = parseFloat(li.margin);
        if (!vol || vol <= 0) { toast.error(`Line ${i + 1}: enter a volume`); return; }
        if (isNaN(margin)) { toast.error(`Line ${i + 1}: enter a margin %`); return; }
      } else {
        const qty = parseFloat(li.quantity);
        const price = parseFloat(li.unitPrice);
        if (!qty || qty <= 0) { toast.error(`Line ${i + 1}: enter a quantity`); return; }
        if (!price || price <= 0) { toast.error(`Line ${i + 1}: enter a unit price`); return; }
      }
    }

    const lineItemsData = lineItems.map((li, i) => ({
      product_type: li.productType,
      volume: lineCalcs[i].vol,
      margin_percent: lineCalcs[i].marginPct,
      sell_price: lineCalcs[i].sellPrice,
      total_ex: lineCalcs[i].totalEx,
      description: li.description || li.productType,
      is_fuel: lineCalcs[i].fuel,
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
        // Supplier is internal-only IP — never embed in customer-facing quote notes
        notes: notes || null,
        valid_until: format(addDays(new Date(), 1), "yyyy-MM-dd"),
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
    const h = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = w - margin * 2;
    let y = 0;

    // PACC Energy website palette
    // bg deep green #0E1F10 (14,31,16), surface #142A16, lime accent #C8F26A (200,242,106),
    // cream text #ECE4D2 (236,228,210), muted #8B8773, sage #3F6B36, border #2A4A2E
    const cream = [236, 228, 210] as const;
    const deepGreen = [14, 31, 16] as const;
    const lime = [200, 242, 106] as const;
    const sage = [63, 107, 54] as const;
    const muted = [139, 135, 115] as const;
    const border = [217, 210, 191] as const; // light cream border on white body
    const textInk = [14, 31, 16] as const; // deep green ink on cream body

    // Cream body background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");

    // Header — deep green band
    doc.setFillColor(...deepGreen);
    doc.rect(0, 0, w, 42, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...cream);
    doc.text("PACC", margin, 26);
    const paccW = doc.getTextWidth("PACC");
    doc.setTextColor(...lime); doc.setFontSize(12);
    doc.text("®", margin + paccW + 1, 22);
    doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text("ENERGY", margin, 33);

    // Lime accent bar under header
    doc.setFillColor(...lime);
    doc.rect(0, 42, w, 1.5, "F");

    y = 58;
    doc.setTextColor(...textInk); doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text("Quote", margin, y);
    y += 10;
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(...muted);
    doc.text("Prepared for ", margin, y);
    const prepW = doc.getTextWidth("Prepared for ");
    doc.setFont("helvetica", "bold"); doc.setTextColor(...textInk);
    doc.text(q.customer_name, margin + prepW, y);
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...muted); doc.setFontSize(9);
    doc.text(format(parseISO(q.created_at), "dd MMMM yyyy"), margin, y);

    // Line items table
    const items: any[] = (q as any).line_items || [];
    y += 14;

    // Always use table format — works for both fuel and non-fuel items
    const hasMultipleItems = items.length > 1;
    const displayItems = items.length > 0 ? items : [{
      description: "Diesel",
      product_type: "Diesel",
      is_fuel: true,
      volume: q.volume_litres,
      sell_price: q.sell_price_per_litre,
      total_ex: q.total_ex_gst,
    }];

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...muted);
    doc.text("Item", margin, y + 4);
    doc.text("Qty / Vol", margin + 60, y + 4);
    doc.text("Unit Price", margin + 95, y + 4);
    doc.text("Total (Ex GST)", margin + contentW, y + 4, { align: "right" });
    y += 8;
    doc.setDrawColor(...border); doc.line(margin, y, margin + contentW, y);
    y += 4;

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    displayItems.forEach((item: any, i: number) => {
      const isFuel = item.is_fuel === true || (!item.product_type || item.product_type === "Diesel");
      doc.setTextColor(...textInk);
      doc.text(item.description || item.product_type || `Line ${i + 1}`, margin, y + 4);
      doc.text(isFuel ? `${Number(item.volume).toLocaleString()}L` : `× ${Number(item.volume).toLocaleString()}`, margin + 60, y + 4);
      doc.text(`$${Number(item.sell_price).toFixed(isFuel ? 4 : 2)}`, margin + 95, y + 4);
      doc.setFont("helvetica", "bold");
      doc.text(`$${Number(item.total_ex).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, margin + contentW, y + 4, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 10;
      doc.setDrawColor(...border); doc.line(margin, y - 2, margin + contentW, y - 2);
    });
    y += 2;

    // Subtotal + GST + Total
    y += 2;
    doc.setDrawColor(...border); doc.line(margin, y, margin + contentW, y);
    y += 4;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...muted);
    doc.text("Subtotal (Ex GST)", margin, y + 4);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...textInk);
    doc.text(`$${Number(q.total_ex_gst).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, margin + contentW, y + 4, { align: "right" });
    y += 10;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...muted);
    doc.text("GST (10%)", margin, y + 4);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...textInk);
    doc.text(`$${(Number(q.total_inc_gst) - Number(q.total_ex_gst)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, margin + contentW, y + 4, { align: "right" });

    y += 14;
    // Total row — sage green band with cream ink to echo the header
    doc.setFillColor(...sage);
    doc.rect(margin, y - 2, contentW, 12, "F");
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(...cream);
    doc.text("Total (Inc GST)", margin, y + 4);
    doc.setFontSize(16);
    doc.text(`$${Number(q.total_inc_gst).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, margin + contentW, y + 4, { align: "right" });
    y += 8;

    if (q.notes) {
      y += 18;
      doc.setFillColor(244, 238, 223); doc.roundedRect(margin, y - 4, contentW, 16, 3, 3, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...textInk);
      doc.text(q.notes, margin + 6, y + 4, { maxWidth: contentW - 12 });
      y += 16;
    }

    // Validity & Melbourne metro
    if (q.valid_until) {
      y += 10; doc.setFontSize(8); doc.setTextColor(...muted);
      doc.text(`This quote is valid for 1 day only — until ${format(parseISO(q.valid_until), "dd MMMM yyyy")}. Valid for Melbourne Metro delivery only.`, margin, y);
    }

    // Tagline & portal info
    y += 14;
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...sage);
    doc.text("You Ring, We Bring.", margin, y);
    y += 7;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...muted);
    const portalLines = [
      "As a PACC Energy customer, you'll have access to our live Customer Portal — track your",
      "machines, plant, and tank data updated in real time. Log in at paccenergy.com/portal.",
    ];
    portalLines.forEach((line) => { doc.text(line, margin, y); y += 4.5; });

    y += 10; doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text("PACC Energy · Melbourne, Australia", margin, y);
    doc.save(`PACC-Quote-${q.customer_name.replace(/\s+/g, "-")}-${format(parseISO(q.created_at), "yyyyMMdd")}.pdf`);
  };

  const handleDuplicateQuote = (q: Quote) => {
    setName(q.customer_name); setEmail(q.customer_email); setPhone(q.customer_phone || ""); setNotes(q.notes || "");
    const items: any[] = (q as any).line_items || [];
    if (items.length > 0) {
      setLineItems(items.map((li: any) => ({
        key: crypto.randomUUID(),
        productType: (li.product_type || "Diesel") as ProductType,
        volume: String(li.volume),
        margin: String(li.margin_percent),
        unitPrice: li.is_fuel ? "" : String(li.sell_price || ""),
        quantity: li.is_fuel ? "1" : String(li.volume || 1),
        description: li.description || "",
      })));
    } else {
      setLineItems([{ key: crypto.randomUUID(), productType: "Diesel" as ProductType, volume: String(q.volume_litres), margin: String(q.margin_percent), unitPrice: "", quantity: "1", description: "" }]);
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
      <div className={`bg-surface border rounded-[10px] p-4 sm:p-5 ${hasTodayPrice ? "border-surface-border" : "border-destructive/50"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Quote Base — Buy Price</div>
          {supplierDelta !== null && cheapestToday && (
            <div className="text-[10px] text-positive font-medium tabular-nums">
              {cheapestToday.supplier} cheaper by ${supplierDelta.toFixed(4)}/L
            </div>
          )}
        </div>
        {!hasTodayPrice ? (
          <div className="text-sm text-destructive font-medium">
            No price entered for today — quotes cannot be created until today's buy price is set in the Buy Price tab.
          </div>
        ) : (
          <>
            {sortedToday.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {sortedToday.map((p) => {
                  const active = selectedSupplier === p.supplier;
                  const isCheap = cheapestToday && p.id === cheapestToday.id && sortedToday.length > 1;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedSupplier(p.supplier)}
                      className={`text-[11px] px-3 py-1.5 rounded-full border cursor-pointer transition-colors flex items-center gap-1.5 ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-surface-border hover:border-foreground/30"
                      }`}
                    >
                      <span>{p.supplier}</span>
                      <span className="tabular-nums opacity-80">${p.price_per_litre.toFixed(4)}</span>
                      {isCheap && <span className={`text-[9px] uppercase tracking-wider ${active ? "text-primary-foreground/90" : "text-positive"}`}>Best</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-foreground tabular-nums">
              <span className="text-2xl sm:text-3xl font-light leading-none">
                ${latestBuyPrice.toFixed(4)}
              </span>
              <span className="text-sm text-muted-foreground">/L</span>
              {selectedTodayPrice && (
                <span className="text-xs text-muted-foreground">· {selectedTodayPrice.supplier}</span>
              )}
            </div>
            {/* TGP delta */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">TGP Benchmark</span>
                <select value={tgpLocation} onChange={(e) => setTgpLocation(e.target.value)} className="bg-[hsl(var(--muted))] border border-surface-border rounded-full text-foreground px-2.5 py-1 text-[10px] outline-none">
                  {TGP_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={tgpProduct} onChange={(e) => setTgpProduct(e.target.value)} className="bg-[hsl(var(--muted))] border border-surface-border rounded-full text-foreground px-2.5 py-1 text-[10px] outline-none">
                  {TGP_PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {todayTGP ? (() => {
                const tgpEx = Number(todayTGP.price_per_litre) / (1 + GST_RATE);
                const delta = latestBuyPrice - tgpEx;
                const pct = tgpEx > 0 ? (delta / tgpEx) * 100 : 0;
                const good = delta <= 0;
                return (
                  <div className="text-[11px] tabular-nums">
                    <span className="text-muted-foreground">TGP ex GST </span>
                    <span className="text-foreground font-medium">${tgpEx.toFixed(4)}/L</span>
                    <span className={`ml-2 font-semibold ${good ? "text-positive" : "text-destructive"}`}>
                      {delta >= 0 ? "+" : ""}${delta.toFixed(4)} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                    </span>
                    <span className="text-muted-foreground"> {good ? "below" : "above"} TGP</span>
                  </div>
                );
              })() : (
                <span className="text-[11px] text-muted-foreground">No TGP for today — refresh in Buy Price tab.</span>
              )}
            </div>
          </>
        )}
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
            <label className="text-[11px] text-muted-foreground">Validity</label>
            <div className="text-[12px] text-muted-foreground px-3 py-2">1 day</div>
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
          <div className="bg-[hsl(var(--muted))] rounded-lg overflow-x-auto">
            <table className="w-full text-[11px] min-w-[600px]">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="px-2 py-2 font-medium w-8">#</th>
                  <th className="px-2 py-2 font-medium w-28">Product</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium">Qty / Vol</th>
                  <th className="px-2 py-2 font-medium">Margin % / Unit $</th>
                  <th className="px-2 py-2 font-medium">Price</th>
                  <th className="px-2 py-2 font-medium">Total Ex GST</th>
                  <th className="px-2 py-2 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, i) => {
                  const calc = lineCalcs[i];
                  const fuel = isFuelType(li.productType);
                  return (
                    <tr key={li.key} className="border-t border-border/50">
                      <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-2">
                        <select
                          value={li.productType}
                          onChange={(e) => {
                            updateLine(li.key, "productType", e.target.value);
                            // Auto-fill description if empty
                            if (!li.description) updateLine(li.key, "description", e.target.value);
                          }}
                          className={smInput}
                        >
                          {PRODUCT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input value={li.description} onChange={(e) => updateLine(li.key, "description", e.target.value)} placeholder={li.productType} className={smInput} />
                      </td>
                      <td className="px-2 py-2">
                        {fuel ? (
                          <input type="number" value={li.volume} onChange={(e) => updateLine(li.key, "volume", e.target.value)} placeholder="Litres" className={smInput} />
                        ) : (
                          <input type="number" value={li.quantity} onChange={(e) => updateLine(li.key, "quantity", e.target.value)} placeholder="Qty" className={smInput} />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {fuel ? (
                          <input type="number" step="0.5" value={li.margin} onChange={(e) => updateLine(li.key, "margin", e.target.value)} placeholder="e.g. 8" className={smInput} />
                        ) : (
                          <input type="number" step="0.01" value={li.unitPrice} onChange={(e) => updateLine(li.key, "unitPrice", e.target.value)} placeholder="$ each" className={smInput} />
                        )}
                      </td>
                      <td className="px-2 py-2 text-foreground tabular-nums whitespace-nowrap">
                        {calc.sellPrice > 0 ? `$${calc.sellPrice.toFixed(fuel ? 4 : 2)}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-foreground tabular-nums font-medium whitespace-nowrap">
                        {calc.totalEx > 0 ? `$${calc.totalEx.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                      </td>
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
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          disabled={!hasFuelItems || grandVolume <= 0}
          className="mt-4 ml-2 bg-transparent text-primary border border-primary/30 rounded-full px-4 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          title="Open the outreach composer prefilled with this quote's sell price"
        >
          <Mail className="w-3.5 h-3.5" /> Email this quote
        </button>
      </div>

      <OutreachComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        defaultCategory="followup"
        sellPricePerLitre={hasFuelItems && grandVolume > 0 ? grandTotalEx / grandVolume * (1 + GST_RATE) : null}
        firstName={name?.split(" ")[0]}
        company={name}
        toEmail={email}
      />

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
                  <div key={q.id} className="flex items-center justify-between py-3" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--surface-border)" : "none" }}>
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
