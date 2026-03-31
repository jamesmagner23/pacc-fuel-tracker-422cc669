import { useState, useMemo, useRef } from "react";
import ImportSpeedsolClients from "./ImportSpeedsolClients";
import { Pencil, Trash2, Plus, Search, Link2, X, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  useCustomerPricing,
  useInsertCustomerPricing,
  useUpdateCustomerPricing,
  useDeleteCustomerPricing,
  PAYMENT_TERMS,
  type CustomerPricing,
} from "@/hooks/useCustomerPricing";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ClientPricingTab() {
  const { data: pricing = [], isLoading } = useCustomerPricing();
  const { data: buyPrices = [] } = useBuyPrices(30);
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, contact_email, contact_phone, speedsol_name, speedsol_names")
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: txnCustomers = [] } = useQuery({
    queryKey: ["speedsol-all-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("nombre_cliente1")
        .not("nombre_cliente1", "is", null);
      if (error) throw error;
      const unique = [...new Set((data || []).map((r) => r.nombre_cliente1!))].sort();
      return unique;
    },
  });

  const insertPricing = useInsertCustomerPricing();
  const updatePricing = useUpdateCustomerPricing();
  const del = useDeleteCustomerPricing();

  const latestBuyPrice = buyPrices[0]?.price_per_litre || 0;

  const [search, setSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<number | null>(null);

  // Tier form state
  const formRef = useRef<HTMLDivElement>(null);
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierFormClientId, setTierFormClientId] = useState<number | "">("");
  const [tierFormEditId, setTierFormEditId] = useState<string | null>(null);
  const [formMinLitres, setFormMinLitres] = useState("0");
  const [formMaxLitres, setFormMaxLitres] = useState("");
  const [formMargin, setFormMargin] = useState("10");
  const [formPricingType, setFormPricingType] = useState("margin");
  const [formTerms, setFormTerms] = useState("30 days");
  const [formNotes, setFormNotes] = useState("");

  // New client creation
  const [creatingNew, setCreatingNew] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // SpeedSol mapping
  const [mappingClientId, setMappingClientId] = useState<number | null>(null);
  const [mappingSearch, setMappingSearch] = useState("");

  // Group pricing by client
  const clientGroups = useMemo(() => {
    const map = new Map<number, { client: typeof clients[0]; tiers: CustomerPricing[] }>();
    pricing.forEach((p) => {
      const client = clients.find((c) => c.id === p.client_account_id);
      if (!map.has(p.client_account_id)) {
        map.set(p.client_account_id, { client: client!, tiers: [] });
      }
      map.get(p.client_account_id)!.tiers.push(p);
    });
    // Sort tiers within each group
    map.forEach((g) => g.tiers.sort((a, b) => a.min_litres - b.min_litres));
    return map;
  }, [pricing, clients]);

  // Unique client IDs that have pricing
  const pricedClientIds = useMemo(() => new Set(pricing.map((p) => p.client_account_id)), [pricing]);
  const unassignedClients = useMemo(() => clients.filter((c) => !pricedClientIds.has(c.id)), [clients, pricedClientIds]);

  // Filtered groups
  const filteredGroups = useMemo(() => {
    const groups = Array.from(clientGroups.entries());
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter(([, g]) => g.client?.company_name?.toLowerCase().includes(q));
  }, [clientGroups, search]);

  // SpeedSol mapping helpers
  const updateSpeedsolNames = useMutation({
    mutationFn: async ({ clientId, names }: { clientId: number; names: string[] }) => {
      const { error } = await supabase
        .from("client_accounts")
        .update({ speedsol_names: names } as any)
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-accounts"] });
      toast.success("SpeedSol mapping updated");
    },
    onError: () => toast.error("Failed to update mapping"),
  });

  const addSpeedsolName = (clientId: number, name: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const current: string[] = (client as any).speedsol_names || [];
    if (current.includes(name)) return;
    updateSpeedsolNames.mutate({ clientId, names: [...current, name] });
  };

  const removeSpeedsolName = (clientId: number, name: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const current: string[] = (client as any).speedsol_names || [];
    updateSpeedsolNames.mutate({ clientId, names: current.filter((n) => n !== name) });
  };

  const allMappedNames = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c: any) => { (c.speedsol_names || []).forEach((n: string) => set.add(n)); });
    return set;
  }, [clients]);

  const unmappedTxnNames = useMemo(() => txnCustomers.filter((n) => !allMappedNames.has(n)), [txnCustomers, allMappedNames]);

  const resetTierForm = () => {
    setShowTierForm(false);
    setTierFormClientId("");
    setTierFormEditId(null);
    setFormMinLitres("0");
    setFormMaxLitres("");
    setFormMargin("10");
    setFormPricingType("margin");
    setFormTerms("30 days");
    setFormNotes("");
    setCreatingNew(false);
    setNewCompanyName("");
    setNewEmail("");
    setNewPhone("");
  };

  const openAddTier = (clientId?: number) => {
    resetTierForm();
    if (clientId) setTierFormClientId(clientId);
    setShowTierForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };

  const openEditTier = (tier: CustomerPricing) => {
    setShowTierForm(true);
    setTierFormEditId(tier.id);
    setTierFormClientId(tier.client_account_id);
    setFormMinLitres(String(tier.min_litres));
    setFormMaxLitres(tier.max_litres != null ? String(tier.max_litres) : "");
    setFormMargin(String(tier.margin_percent));
    setFormPricingType(tier.pricing_type || "margin");
    setFormTerms(tier.payment_terms);
    setFormNotes(tier.notes || "");
    setCreatingNew(false);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };

  const handleSaveTier = async () => {
    const margin = parseFloat(formMargin);
    const minL = parseFloat(formMinLitres) || 0;
    const maxL = formMaxLitres ? parseFloat(formMaxLitres) : null;

    let clientId = tierFormClientId as number;

    if (creatingNew) {
      const name = newCompanyName.trim();
      const email = newEmail.trim();
      if (!name) { toast.error("Enter a company name"); return; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Enter a valid email"); return; }
      if (isNaN(margin)) { toast.error("Enter a valid margin"); return; }
      try {
        const { data: newClient, error } = await supabase
          .from("client_accounts")
          .insert({ company_name: name, contact_email: email, contact_phone: newPhone.trim() || null })
          .select("id")
          .single();
        if (error) throw error;
        clientId = newClient.id;
      } catch {
        toast.error("Failed to create client");
        return;
      }
    } else {
      if (!tierFormClientId || isNaN(margin)) {
        toast.error("Select a client and enter a valid margin");
        return;
      }
    }

    if (maxL !== null && maxL <= minL) {
      toast.error("Max litres must be greater than min litres");
      return;
    }

    const tierData = {
      client_account_id: clientId,
      margin_percent: margin,
      min_litres: minL,
      max_litres: maxL,
      pricing_type: formPricingType,
      payment_terms: formTerms,
      weekly_volume_tier: `${minL}-${maxL ?? "∞"}`,
      notes: formNotes || null,
    };

    try {
      if (tierFormEditId) {
        await updatePricing.mutateAsync({ id: tierFormEditId, ...tierData });
        toast.success("Tier updated");
        resetTierForm();
      } else {
        await insertPricing.mutateAsync(tierData);
        toast.success("Tier added — add another or click Done");
        // Keep form open for same client, auto-advance min litres
        setTierFormEditId(null);
        setFormMinLitres(maxL != null ? String(maxL + 1) : "");
        setFormMaxLitres("");
        setFormMargin("");
        setFormNotes("");
      }
      if (clientId) setExpandedClient(clientId);
    } catch {
      toast.error("Failed to save tier");
    }
  };

  const sellPrice = (marginPct: number, type: string) => {
    if (type === "markup") return latestBuyPrice + marginPct / 100;
    return latestBuyPrice * (1 + marginPct / 100);
  };

  const inputClass = "bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full";
  const selectClass = "bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full appearance-none";

  const uniqueClients = new Set(pricing.map((p) => p.client_account_id));
  const avgMargin = pricing.length > 0 ? pricing.reduce((s, p) => s + p.margin_percent, 0) / pricing.length : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Clients Priced</div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">{uniqueClients.size}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">of {clients.length} total</div>
        </div>
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Tiers</div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">{pricing.length}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">across all clients</div>
        </div>
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Margin</div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">
            {pricing.length > 0 ? avgMargin.toFixed(1) : "—"}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">blended average</div>
        </div>
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Buy Price</div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">
            {latestBuyPrice > 0 ? `$${latestBuyPrice.toFixed(4)}` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">current base</div>
        </div>
      </div>

      <ImportSpeedsolClients existingSpeedsolNames={clients.map((c) => (c as any).speedsol_name).filter(Boolean)} />

      {/* Add / Edit tier form */}
      <div ref={formRef} className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {tierFormEditId ? "Edit Pricing Tier" : "Add Pricing Tier"}
          </div>
          {!showTierForm && (
            <button
              onClick={() => openAddTier()}
              className="bg-primary text-primary-foreground border-none rounded-full px-4 py-1.5 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Tier
            </button>
          )}
        </div>

        {showTierForm && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Client *</label>
                {creatingNew ? (
                  <div className="flex flex-col gap-2">
                    <input type="text" placeholder="Company name" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className={inputClass} />
                    <input type="email" placeholder="Contact email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputClass} />
                    <input type="tel" placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputClass} />
                    <button onClick={() => { setCreatingNew(false); setNewCompanyName(""); setNewEmail(""); }} className="text-[11px] text-muted-foreground hover:text-foreground self-start bg-transparent border-none cursor-pointer">← Back to select</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <select value={tierFormClientId} onChange={(e) => setTierFormClientId(e.target.value ? Number(e.target.value) : "")} className={selectClass} disabled={!!tierFormEditId}>
                      <option value="">Select client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.company_name}</option>
                      ))}
                    </select>
                    {!tierFormEditId && (
                      <button onClick={() => { setCreatingNew(true); setTierFormClientId(""); }} className="text-[11px] text-primary hover:text-primary/80 self-start flex items-center gap-1 bg-transparent border-none cursor-pointer">
                        <Plus className="w-3 h-3" /> Create new client
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Pricing Type</label>
                <select value={formPricingType} onChange={(e) => setFormPricingType(e.target.value)} className={selectClass}>
                  <option value="margin">Margin % (of buy price)</option>
                  <option value="markup">Markup ¢/L (fixed cents)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Min Litres</label>
                <input type="number" value={formMinLitres} onChange={(e) => setFormMinLitres(e.target.value)} placeholder="0" className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Max Litres</label>
                <input type="number" value={formMaxLitres} onChange={(e) => setFormMaxLitres(e.target.value)} placeholder="No limit" className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">
                  {formPricingType === "markup" ? "Markup ¢/L *" : "Margin % *"}
                </label>
                <input type="number" step="0.5" value={formMargin} onChange={(e) => setFormMargin(e.target.value)} placeholder={formPricingType === "markup" ? "e.g. 8" : "e.g. 12"} className={inputClass} />
                {latestBuyPrice > 0 && formMargin && (
                  <div className="text-[10px] text-muted-foreground">
                    Sell: ${sellPrice(parseFloat(formMargin) || 0, formPricingType).toFixed(4)}/L
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Payment Terms</label>
                <select value={formTerms} onChange={(e) => setFormTerms(e.target.value)} className={selectClass}>
                  {PAYMENT_TERMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground">Notes</label>
              <input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional" className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveTier} disabled={insertPricing.isPending || updatePricing.isPending} className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2 text-[11px] font-semibold cursor-pointer disabled:opacity-70">
                {insertPricing.isPending || updatePricing.isPending ? "Saving…" : tierFormEditId ? "Update" : "Save"}
              </button>
              <button onClick={resetTierForm} className="bg-transparent text-muted-foreground border border-surface-border rounded-full px-5 py-2 text-[11px] cursor-pointer">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Margin chart */}
      {pricing.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Margin by Client (avg across tiers)</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Array.from(clientGroups.entries()).map(([id, g]) => {
                  const avg = g.tiers.reduce((s, t) => s + t.margin_percent, 0) / g.tiers.length;
                  const name = g.client?.company_name || "Unknown";
                  return { name: name.length > 12 ? name.slice(0, 12) + "…" : name, fullName: name, margin: Math.round(avg * 10) / 10, tiers: g.tiers.length };
                }).sort((a, b) => b.margin - a.margin)}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              >
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" width={36} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [`${value}%`, "Avg Margin"]}
                  labelFormatter={(_l, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? `${item.fullName} · ${item.tiers} tier${item.tiers !== 1 ? "s" : ""}` : _l;
                  }}
                />
                <Bar dataKey="margin" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {Array.from(clientGroups.entries()).sort(([, a], [, b]) => {
                    const aAvg = a.tiers.reduce((s, t) => s + t.margin_percent, 0) / a.tiers.length;
                    const bAvg = b.tiers.reduce((s, t) => s + t.margin_percent, 0) / b.tiers.length;
                    return bAvg - aAvg;
                  }).map(([id], i) => (
                    <Cell key={id} fill={i % 2 === 0 ? "#E8461E" : "#8B7355"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Client pricing list with expandable tiers */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Client Pricing ({uniqueClients.size} clients · {pricing.length} tiers)
          </div>
          <div className="relative">
            <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client…" className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground pl-7 pr-3 py-1.5 text-[11px] outline-none w-40" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-[13px]">Loading…</div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-muted-foreground text-[13px]">
            {pricing.length === 0 ? "No client pricing set up yet. Add your first tier above." : "No results."}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredGroups.map(([clientId, group], gi) => {
              const client = group.client;
              const tiers = group.tiers;
              const isExpanded = expandedClient === clientId;
              const clientSpeedsolNames: string[] = (client as any)?.speedsol_names || [];
              const isMapping = mappingClientId === clientId;
              const bestMargin = Math.min(...tiers.map((t) => t.margin_percent));
              const worstMargin = Math.max(...tiers.map((t) => t.margin_percent));

              return (
                <div key={clientId} style={{ borderBottom: gi < filteredGroups.length - 1 ? "1px solid hsl(var(--border))" : "none" }}>
                  {/* Client header row */}
                  <div className="py-3 flex items-center justify-between cursor-pointer" onClick={() => setExpandedClient(isExpanded ? null : clientId)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                        <span className="text-[13px] font-medium text-foreground truncate">{client?.company_name || "Unknown"}</span>
                        <span className="text-[10px] text-muted-foreground">{tiers.length} tier{tiers.length !== 1 ? "s" : ""}</span>
                      </div>
                      {clientSpeedsolNames.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 ml-5.5">
                          {clientSpeedsolNames.map((n) => (
                            <span key={n} className="inline-flex items-center gap-1 text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                              {n}
                              {isMapping && (
                                <button onClick={(e) => { e.stopPropagation(); removeSpeedsolName(clientId, n); }} className="hover:text-destructive bg-transparent border-none p-0 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {clientSpeedsolNames.length === 0 && !isMapping && (
                        <div className="text-[9px] text-warning mt-1 ml-5.5">⚠ No SpeedSol names mapped</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground tabular-nums">
                          {bestMargin === worstMargin ? `+${bestMargin}%` : `+${bestMargin}–${worstMargin}%`}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{tiers[0]?.payment_terms}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setMappingClientId(isMapping ? null : clientId); }} title="Map SpeedSol names" className={`bg-transparent border-none cursor-pointer p-1.5 transition-colors ${isMapping ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openAddTier(clientId); }} title="Add tier" className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-primary p-1.5 transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded tiers */}
                  {isExpanded && (
                    <div className="ml-5.5 pb-3">
                      <div className="bg-[hsl(var(--muted))] rounded-lg overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-muted-foreground text-left">
                              <th className="px-3 py-2 font-medium">Volume Range</th>
                              <th className="px-3 py-2 font-medium">Type</th>
                              <th className="px-3 py-2 font-medium">Margin/Markup</th>
                              <th className="px-3 py-2 font-medium">Sell Price</th>
                              <th className="px-3 py-2 font-medium">Terms</th>
                              <th className="px-3 py-2 font-medium w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {tiers.map((tier) => (
                              <tr key={tier.id} className="border-t border-border/50">
                                <td className="px-3 py-2 text-foreground tabular-nums">
                                  {tier.min_litres.toLocaleString()}–{tier.max_litres != null ? tier.max_litres.toLocaleString() : "∞"} L
                                </td>
                                <td className="px-3 py-2 text-foreground capitalize">{tier.pricing_type || "margin"}</td>
                                <td className="px-3 py-2 text-foreground tabular-nums font-medium">
                                  {tier.pricing_type === "markup" ? `${tier.margin_percent}¢/L` : `+${tier.margin_percent}%`}
                                </td>
                                <td className="px-3 py-2 text-foreground tabular-nums">
                                  {latestBuyPrice > 0 ? `$${sellPrice(tier.margin_percent, tier.pricing_type).toFixed(4)}/L` : "—"}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{tier.payment_terms}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => openEditTier(tier)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3 h-3" /></button>
                                    <button onClick={() => del.mutate(tier.id)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {tiers.length > 0 && tiers[0]?.notes && (
                        <div className="text-[10px] text-muted-foreground/70 mt-1.5 px-1">{tiers[0].notes}</div>
                      )}
                    </div>
                  )}

                  {/* SpeedSol mapping editor */}
                  {isMapping && (
                    <div className="ml-5.5 mb-3 p-3 bg-[hsl(var(--muted))] rounded-lg">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                        Map SpeedSol Names → {client?.company_name}
                      </div>
                      <input type="text" placeholder="Search SpeedSol names…" value={mappingSearch} onChange={(e) => setMappingSearch(e.target.value)} className="bg-card border border-border rounded-lg text-foreground px-3 py-1.5 text-[11px] outline-none w-full mb-2" />
                      <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                        {unmappedTxnNames
                          .filter((n) => !mappingSearch || n.toLowerCase().includes(mappingSearch.toLowerCase()))
                          .map((name) => (
                            <button key={name} onClick={() => addSpeedsolName(clientId, name)} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-card text-left bg-transparent border-none cursor-pointer w-full">
                              <Plus className="w-3 h-3 text-primary flex-shrink-0" />
                              <span className="text-[11px] text-foreground">{name}</span>
                            </button>
                          ))}
                        {unmappedTxnNames.filter((n) => !mappingSearch || n.toLowerCase().includes(mappingSearch.toLowerCase())).length === 0 && (
                          <div className="text-[11px] text-muted-foreground py-2 px-2">All names are mapped</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
