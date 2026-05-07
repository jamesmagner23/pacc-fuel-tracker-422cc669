import { useMemo, useCallback } from "react";
import { format, parseISO, startOfWeek, getISOWeek } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { useCustomerPricing, findTierForVolume } from "@/hooks/useCustomerPricing";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/hooks/useDemo";
import { DEMO_CLIENT_ACCOUNTS } from "@/data/demoData";

export default function PLOverview() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: previous = [] } = usePreviousTransactions(range);
  const { data: buyPrices = [] } = useBuyPrices(365);
  const { data: customerPricing = [] } = useCustomerPricing();
  const isDemo = useDemo();
  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts", isDemo],
    queryFn: async () => {
      if (isDemo) {
        return DEMO_CLIENT_ACCOUNTS.map(c => ({
          id: c.id,
          company_name: c.company_name,
          speedsol_name: c.speedsol_name,
          speedsol_names: c.speedsol_names,
        }));
      }
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, speedsol_name, speedsol_names")
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  const latestBuyPrice = buyPrices[0]?.price_per_litre || 0;

  // Build speedsol → client mapping for revenue calculation
  const speedsolToClientId = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c: any) => {
      const names: string[] = c.speedsol_names || [];
      names.forEach((n: string) => { if (n) map.set(n.toLowerCase(), c.id); });
      if (c.speedsol_name) map.set(c.speedsol_name.toLowerCase(), c.id);
      map.set(c.company_name.toLowerCase(), c.id);
    });
    return map;
  }, [clients]);

  // Calculate average weekly litres per client from current period transactions
  const clientWeeklyVolumes = useMemo(() => {
    const clientWeeks = new Map<number, Map<string, number>>(); // clientId → weekKey → litres
    const allTxs = [...filtered, ...previous];
    allTxs.forEach((t: any) => {
      const clientId = speedsolToClientId.get((t.nombre_cliente1 || "").toLowerCase());
      if (!clientId) return;
      const txDate = t.fecha ? new Date(t.fecha) : null;
      if (!txDate) return;
      const weekKey = `${txDate.getFullYear()}-W${getISOWeek(txDate)}`;
      if (!clientWeeks.has(clientId)) clientWeeks.set(clientId, new Map());
      const weeks = clientWeeks.get(clientId)!;
      weeks.set(weekKey, (weeks.get(weekKey) || 0) + (t.cantidad || 0));
    });
    // Average weekly volume per client
    const result = new Map<number, number>();
    clientWeeks.forEach((weeks, clientId) => {
      const totalLitres = Array.from(weeks.values()).reduce((s, v) => s + v, 0);
      const numWeeks = weeks.size || 1;
      result.set(clientId, totalLitres / numWeeks);
    });
    return result;
  }, [filtered, previous, speedsolToClientId]);

  // Helper: get sell price for a transaction based on client's weekly volume tier
  const getTxPricing = useCallback((t: any) => {
    if (t.ppu && t.ppu > 0) return { hasPricing: true, sellPPL: t.ppu };
    const clientId = speedsolToClientId.get((t.nombre_cliente1 || "").toLowerCase());
    if (!clientId) return { hasPricing: false, sellPPL: 0 };
    const weeklyVol = clientWeeklyVolumes.get(clientId) || 0;
    const tier = findTierForVolume(customerPricing, clientId, weeklyVol);
    if (!tier) return { hasPricing: false, sellPPL: 0 };
    const sell = tier.pricing_type === "markup"
      ? latestBuyPrice + tier.margin_percent / 100
      : latestBuyPrice * (1 + tier.margin_percent / 100);
    return { hasPricing: true, sellPPL: sell };
  }, [speedsolToClientId, customerPricing, latestBuyPrice, clientWeeklyVolumes]);

  // Only include priced transactions in revenue/profit KPIs
  const pricedTxs = filtered.filter((t) => getTxPricing(t).hasPricing);
  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const pricedLitres = pricedTxs.reduce((s, t) => s + (t.cantidad || 0), 0);
  const totalRevenue = pricedTxs.reduce((s, t) => {
    const litres = t.cantidad || 0;
    const { sellPPL } = getTxPricing(t);
    return s + (t.dinero_total && t.dinero_total > 0 ? t.dinero_total : litres * sellPPL);
  }, 0);
  const numDeliveries = filtered.length;
  const totalCost = pricedLitres * latestBuyPrice;
  const grossProfit = totalRevenue - totalCost;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const pricedPrev = previous.filter((t) => getTxPricing(t).hasPricing);
  const prevLitres = previous.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevPricedLitres = pricedPrev.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevRevenue = pricedPrev.reduce((s, t) => {
    const litres = t.cantidad || 0;
    const { sellPPL } = getTxPricing(t);
    return s + (t.dinero_total && t.dinero_total > 0 ? t.dinero_total : litres * sellPPL);
  }, 0);
  const prevCost = prevPricedLitres * latestBuyPrice;
  const prevGrossProfit = prevRevenue - prevCost;

  const pct = (c: number, p: number) => (p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100);
  const rangeLabel = range === "today" ? "Today" : range === "week" ? "This Week" : "This Month";

  // Per-client breakdown using actual transaction data + individual margins
  const clientBreakdown = useMemo(() => {
    // Build speedsol_name → client mapping (supports array of names per client)
    const speedsolToClient = new Map<string, { id: number; name: string }>();
    clients.forEach((c: any) => {
      // Map from speedsol_names array (primary)
      const names: string[] = c.speedsol_names || [];
      names.forEach((n: string) => {
        if (n) speedsolToClient.set(n.toLowerCase(), { id: c.id, name: c.company_name });
      });
      // Fallback: legacy speedsol_name field
      if (c.speedsol_name) {
        speedsolToClient.set(c.speedsol_name.toLowerCase(), { id: c.id, name: c.company_name });
      }
      // Also map by company_name
      speedsolToClient.set(c.company_name.toLowerCase(), { id: c.id, name: c.company_name });
    });

    // Aggregate transactions by client
    const byClient: Record<string, { name: string; litres: number; revenue: number; clientId: number | null }> = {};
    filtered.forEach((t) => {
      const rawName = t.nombre_cliente1 || "Unmatched";
      const matched = speedsolToClient.get(rawName.toLowerCase());
      const key = matched ? matched.name : rawName;
      if (!byClient[key]) {
        byClient[key] = { name: key, litres: 0, revenue: 0, clientId: matched?.id || null };
      }
      const litres = t.cantidad || 0;
      byClient[key].litres += litres;
      const { hasPricing, sellPPL } = getTxPricing(t);
      if (t.dinero_total && t.dinero_total > 0) {
        byClient[key].revenue += t.dinero_total;
      } else if (hasPricing) {
        byClient[key].revenue += litres * sellPPL;
      }
    });

    return Object.values(byClient)
      .map((c) => {
        const pricing = c.clientId
          ? customerPricing.find((p) => p.client_account_id === c.clientId)
          : null;
        const cost = pricing ? c.litres * latestBuyPrice : 0;
        const profit = pricing ? c.revenue - cost : 0;
        const margin = c.revenue > 0 ? (profit / c.revenue) * 100 : 0;
        return {
          ...c,
          cost,
          profit,
          margin,
          hasCustomPricing: !!pricing,
          customMargin: pricing?.margin_percent ?? null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, clients, customerPricing, latestBuyPrice, getTxPricing]);

  if (isLoading) {
    return <div className="text-muted-foreground text-[13px] py-16 text-center">Loading…</div>;
  }

  const unpricedClients = clientBreakdown.filter((c) => !c.hasCustomPricing);
  const pricedClients = clientBreakdown.filter((c) => c.hasCustomPricing);
  const unpricedLitres = unpricedClients.reduce((s, c) => s + c.litres, 0);

  const kpis = [
    {
      label: "Revenue",
      value: "$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${pricedClients.length} priced client${pricedClients.length !== 1 ? "s" : ""} only`,
      pct: pct(totalRevenue, prevRevenue),
    },
    {
      label: "Cost of Fuel",
      value: "$" + totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${pricedLitres.toLocaleString()}L × $${latestBuyPrice.toFixed(4)}`,
      pct: null,
      positive: null as boolean | null,
    },
    {
      label: "Gross Profit",
      value: "$" + grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${rangeLabel} · priced clients`,
      pct: pct(grossProfit, prevGrossProfit),
      positive: grossProfit >= 0,
    },
    {
      label: "Gross Margin",
      value: grossMargin.toFixed(1) + "%",
      sub: "profit ÷ revenue",
      pct: null,
      positive: grossMargin >= 0,
    },
    {
      label: "Litres Delivered",
      value: totalLitres.toLocaleString() + "L",
      sub: rangeLabel,
      pct: pct(totalLitres, prevLitres),
    },
    {
      label: "Deliveries",
      value: numDeliveries.toString(),
      sub: rangeLabel,
      pct: pct(numDeliveries, previous.length),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {k.label}
            </div>
            <div
              className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums"
              style={{
                color:
                  k.positive === false
                    ? "var(--negative)"
                    : k.positive === true
                    ? "var(--positive)"
                    : "var(--text-primary)",
              }}
            >
              {k.value}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              {k.pct !== undefined && k.pct !== null && (
                <span
                  className="text-[11px] flex items-center gap-1"
                  style={{ color: k.pct >= 0 ? "var(--positive)" : "var(--negative)" }}
                >
                  {k.pct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {k.pct >= 0 ? "+" : ""}
                  {k.pct.toFixed(1)}%
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Unpriced clients notice */}
      {unpricedClients.length > 0 && (
        <div className="bg-surface border border-yellow-500/20 rounded-[10px] p-4 flex items-start gap-3">
          <div className="text-yellow-500 text-lg mt-0.5">⚠</div>
          <div>
            <div className="text-[12px] font-medium text-foreground">
              {unpricedClients.length} client{unpricedClients.length !== 1 ? "s" : ""} without pricing ({unpricedLitres.toLocaleString()}L)
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Revenue &amp; profit only includes clients with pricing set in Client Pricing. Assign pricing to see full P&amp;L.
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {unpricedClients.slice(0, 8).map((c) => (
                <span key={c.name} className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">
                  {c.name} ({c.litres.toLocaleString()}L)
                </span>
              ))}
              {unpricedClients.length > 8 && (
                <span className="text-[10px] text-muted-foreground px-2 py-0.5">
                  +{unpricedClients.length - 8} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-client profit breakdown — priced clients only */}
      {pricedClients.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
            Profit by Client — {rangeLabel}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pricedClients.slice(0, 10).map((c) => ({
                  name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
                  fullName: c.name,
                  profit: Math.round(c.profit),
                  revenue: Math.round(c.revenue),
                  litres: Math.round(c.litres),
                  margin: c.margin,
                }))}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={42}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                  contentStyle={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: 8,
                    fontSize: 11,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                  }}
                  labelStyle={{ color: "var(--text-primary)" }}
                  itemStyle={{ color: "var(--text-primary)" }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Profit"]}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload;
                    if (!item) return _label;
                    return `${item.fullName} · ${item.litres.toLocaleString()}L · ${item.margin.toFixed(1)}% margin`;
                  }}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {pricedClients.slice(0, 10).map((c, i) => (
                    <Cell
                      key={i}
                      fill={c.profit >= 0 ? "var(--positive)" : "var(--negative)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--positive)" }} /> Profitable
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-destructive inline-block" /> Loss
            </span>
          </div>
        </div>
      )}

      {/* Client detail table */}
      {clientBreakdown.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
            Client Detail — {rangeLabel}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium text-right">Litres</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                  <th className="pb-2 font-medium text-right">Profit</th>
                  <th className="pb-2 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {clientBreakdown.map((c) => (
                  <tr key={c.name} className="border-b border-border/50">
                    <td className="py-2.5 text-foreground font-medium">
                      {c.name}
                      {c.hasCustomPricing ? (
                        <span className="ml-1.5 text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          priced
                        </span>
                      ) : (
                        <span className="ml-1.5 text-[9px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">
                          unpriced
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-foreground tabular-nums">
                      {c.litres.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right tabular-nums" style={{ color: c.hasCustomPricing ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {c.hasCustomPricing ? `$${c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {c.hasCustomPricing ? `$${c.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td
                      className="py-2.5 text-right font-medium tabular-nums"
                      style={{ color: !c.hasCustomPricing ? "var(--text-secondary)" : c.profit >= 0 ? "var(--positive)" : "var(--negative)" }}
                    >
                      {c.hasCustomPricing ? `$${c.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td
                      className="py-2.5 text-right tabular-nums"
                      style={{ color: !c.hasCustomPricing ? "var(--text-secondary)" : c.margin >= 0 ? "var(--positive)" : "var(--negative)" }}
                    >
                      {c.hasCustomPricing ? `${c.margin.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
                {/* Totals row — priced only */}
                <tr className="font-semibold border-t border-border">
                  <td className="py-2.5 text-foreground">Total (priced)</td>
                  <td className="py-2.5 text-right text-foreground tabular-nums">
                    {pricedLitres.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-foreground tabular-nums">
                    ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                    ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className="py-2.5 text-right tabular-nums"
                    style={{ color: grossProfit >= 0 ? "var(--positive)" : "var(--negative)" }}
                  >
                    ${grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className="py-2.5 text-right tabular-nums"
                    style={{ color: grossMargin >= 0 ? "var(--positive)" : "var(--negative)" }}
                  >
                    {grossMargin.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
