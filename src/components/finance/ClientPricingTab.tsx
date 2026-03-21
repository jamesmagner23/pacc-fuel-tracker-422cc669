import { useState, useMemo } from "react";
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import {
  useCustomerPricing,
  useUpsertCustomerPricing,
  useDeleteCustomerPricing,
  VOLUME_TIERS,
  PAYMENT_TERMS,
  type CustomerPricing,
} from "@/hooks/useCustomerPricing";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ClientPricingTab() {
  const { data: pricing = [], isLoading } = useCustomerPricing();
  const { data: buyPrices = [] } = useBuyPrices(30);
  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, contact_email, contact_phone")
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
  });
  const upsert = useUpsertCustomerPricing();
  const del = useDeleteCustomerPricing();

  const latestBuyPrice = buyPrices[0]?.price_per_litre || 0;

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [formClientId, setFormClientId] = useState<number | "">("");
  const [formMargin, setFormMargin] = useState("10");
  const [formTerms, setFormTerms] = useState("30 days");
  const [formTier, setFormTier] = useState("0-500");
  const [formNotes, setFormNotes] = useState("");

  // Merge pricing with client info
  const pricingWithClients = useMemo(() => {
    return pricing.map((p) => {
      const client = clients.find((c) => c.id === p.client_account_id);
      return { ...p, client_name: client?.company_name || "Unknown", client_email: client?.contact_email || "" };
    });
  }, [pricing, clients]);

  const filtered = useMemo(() => {
    if (!search) return pricingWithClients;
    const q = search.toLowerCase();
    return pricingWithClients.filter(
      (p) => p.client_name.toLowerCase().includes(q) || p.weekly_volume_tier.includes(q)
    );
  }, [pricingWithClients, search]);

  // Clients without pricing
  const unassignedClients = useMemo(() => {
    const assignedIds = new Set(pricing.map((p) => p.client_account_id));
    return clients.filter((c) => !assignedIds.has(c.id));
  }, [clients, pricing]);

  const resetForm = () => {
    setFormClientId("");
    setFormMargin("10");
    setFormTerms("30 days");
    setFormTier("0-500");
    setFormNotes("");
    setEditingId(null);
    setShowAdd(false);
  };

  const handleEdit = (p: CustomerPricing & { client_name: string }) => {
    setFormClientId(p.client_account_id);
    setFormMargin(String(p.margin_percent));
    setFormTerms(p.payment_terms);
    setFormTier(p.weekly_volume_tier);
    setFormNotes(p.notes || "");
    setEditingId(p.client_account_id);
    setShowAdd(true);
  };

  const handleSave = async () => {
    const margin = parseFloat(formMargin);
    if (!formClientId || isNaN(margin)) {
      toast.error("Select a client and enter a valid margin");
      return;
    }
    try {
      await upsert.mutateAsync({
        client_account_id: formClientId as number,
        margin_percent: margin,
        payment_terms: formTerms,
        weekly_volume_tier: formTier,
        notes: formNotes || null,
      });
      toast.success(editingId ? "Pricing updated" : "Pricing added");
      resetForm();
    } catch {
      toast.error("Failed to save pricing");
    }
  };

  const inputClass = "bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full";
  const selectClass = "bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[12px] outline-none w-full appearance-none";

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Clients Priced</div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">{pricing.length}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">of {clients.length} total</div>
        </div>
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Margin</div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">
            {pricing.length > 0
              ? (pricing.reduce((s, p) => s + p.margin_percent, 0) / pricing.length).toFixed(1)
              : "—"}%
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
        <div className="bg-surface border border-surface-border rounded-[10px] p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Unassigned</div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">{unassignedClients.length}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">clients without pricing</div>
        </div>
      </div>

      {/* Add / Edit form */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {editingId ? "Edit Client Pricing" : "Add Client Pricing"}
          </div>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-primary text-primary-foreground border-none rounded-full px-4 py-1.5 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>

        {showAdd && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Client *</label>
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value ? Number(e.target.value) : "")}
                  className={selectClass}
                  disabled={!!editingId}
                >
                  <option value="">Select client…</option>
                  {(editingId ? clients : unassignedClients).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Margin % *</label>
                <input
                  type="number"
                  step="0.5"
                  value={formMargin}
                  onChange={(e) => setFormMargin(e.target.value)}
                  placeholder="e.g. 12"
                  className={inputClass}
                />
                {latestBuyPrice > 0 && formMargin && (
                  <div className="text-[10px] text-muted-foreground">
                    Sell: ${(latestBuyPrice * (1 + (parseFloat(formMargin) || 0) / 100)).toFixed(4)}/L
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Weekly Volume Tier</label>
                <select value={formTier} onChange={(e) => setFormTier(e.target.value)} className={selectClass}>
                  {VOLUME_TIERS.map((t) => (
                    <option key={t} value={t}>{t} L</option>
                  ))}
                </select>
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
              <button
                onClick={handleSave}
                disabled={upsert.isPending}
                className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2 text-[11px] font-semibold cursor-pointer disabled:opacity-70"
              >
                {upsert.isPending ? "Saving…" : editingId ? "Update" : "Save"}
              </button>
              <button
                onClick={resetForm}
                className="bg-transparent text-muted-foreground border border-surface-border rounded-full px-5 py-2 text-[11px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Margin distribution chart */}
      {pricingWithClients.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
            Margin Distribution by Client
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pricingWithClients
                  .slice()
                  .sort((a, b) => b.margin_percent - a.margin_percent)
                  .map((p) => ({
                    name: p.client_name.length > 12 ? p.client_name.slice(0, 12) + "…" : p.client_name,
                    fullName: p.client_name,
                    margin: p.margin_percent,
                    tier: p.weekly_volume_tier,
                    terms: p.payment_terms,
                  }))}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(value: number) => [`${value}%`, "Margin"]}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload;
                    if (!item) return _label;
                    return `${item.fullName} · ${item.tier}L/wk · ${item.terms}`;
                  }}
                />
                <Bar dataKey="margin" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {pricingWithClients
                    .slice()
                    .sort((a, b) => b.margin_percent - a.margin_percent)
                    .map((_, i) => {
                      const avg = pricing.reduce((s, p) => s + p.margin_percent, 0) / pricing.length;
                      const sorted = pricingWithClients.slice().sort((a, b) => b.margin_percent - a.margin_percent);
                      const isAbove = sorted[i]?.margin_percent >= avg;
                      return (
                        <Cell
                          key={i}
                          fill={isAbove ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)"}
                        />
                      );
                    })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> ≥ Avg margin
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40 inline-block" /> Below avg
            </span>
          </div>
        </div>
      )}

      {/* Client pricing list */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Client Pricing ({filtered.length})
          </div>
          <div className="relative">
            <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client…"
              className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground pl-7 pr-3 py-1.5 text-[11px] outline-none w-40"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-[13px]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground text-[13px]">
            {pricing.length === 0 ? "No client pricing set up yet. Add your first one above." : "No results."}
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((p, i) => {
              const sellPrice = latestBuyPrice * (1 + p.margin_percent / 100);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid hsl(var(--border))" : "none" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-foreground truncate">{p.client_name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {p.weekly_volume_tier}L/wk · {p.payment_terms}
                    </div>
                    {p.notes && (
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{p.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-foreground tabular-nums">+{p.margin_percent}%</div>
                      {latestBuyPrice > 0 && (
                        <div className="text-[10px] text-muted-foreground tabular-nums">${sellPrice.toFixed(4)}/L</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleEdit(p)}
                      title="Edit"
                      className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1.5 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => del.mutate(p.id)}
                      title="Delete"
                      className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
