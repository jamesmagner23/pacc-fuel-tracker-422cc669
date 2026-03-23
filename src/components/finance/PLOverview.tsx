import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function PLOverview() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: previous = [] } = usePreviousTransactions(range);
  const { data: buyPrices = [] } = useBuyPrices(365);
  const { data: customerPricing = [] } = useCustomerPricing();
  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, speedsol_name")
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  const latestBuyPrice = buyPrices[0]?.price_per_litre || 0;

  // Per-client breakdown using actual transaction data + individual margins
  const clientBreakdown = useMemo(() => {
    if (isLoading) return [];
    // Build speedsol_name → client mapping
    const speedsolToClient = new Map<string, { id: number; name: string }>();
    clients.forEach((c) => {
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
      byClient[key].litres += t.cantidad || 0;
      byClient[key].revenue += t.dinero_total || 0;
    });

    // Calculate profit per client
    return Object.values(byClient)
      .map((c) => {
        const pricing = c.clientId
          ? customerPricing.find((p) => p.client_account_id === c.clientId)
          : null;
        const cost = c.litres * latestBuyPrice;
        const profit = c.revenue - cost;
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
  }, [filtered, clients, customerPricing, latestBuyPrice]);

  const kpis = [
    {
      label: "Revenue",
      value: "$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${rangeLabel} · actual from transactions`,
      pct: pct(totalRevenue, prevRevenue),
    },
    {
      label: "Cost of Fuel",
      value: "$" + totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${totalLitres.toLocaleString()}L × $${latestBuyPrice.toFixed(4)}`,
      pct: null,
      positive: null as boolean | null,
    },
    {
      label: "Gross Profit",
      value: "$" + grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${rangeLabel} · revenue − cost`,
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
                    ? "hsl(var(--destructive))"
                    : k.positive === true
                    ? "#10B981"
                    : "hsl(var(--foreground))",
              }}
            >
              {k.value}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              {k.pct !== undefined && k.pct !== null && (
                <span
                  className="text-[11px] flex items-center gap-1"
                  style={{ color: k.pct >= 0 ? "#10B981" : "hsl(var(--destructive))" }}
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

      {/* Per-client profit breakdown */}
      {clientBreakdown.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
            Profit by Client — {rangeLabel}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={clientBreakdown.slice(0, 10).map((c) => ({
                  name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
                  fullName: c.name,
                  profit: Math.round(c.profit),
                  revenue: Math.round(c.revenue),
                  litres: Math.round(c.litres),
                  margin: c.margin,
                  hasPricing: c.hasCustomPricing,
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
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={42}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Profit"]}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload;
                    if (!item) return _label;
                    return `${item.fullName} · ${item.litres.toLocaleString()}L · ${item.margin.toFixed(1)}% margin`;
                  }}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {clientBreakdown.slice(0, 10).map((c, i) => (
                    <Cell
                      key={i}
                      fill={c.profit >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Profitable
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
                      {c.hasCustomPricing && (
                        <span className="ml-1.5 text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          priced
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-foreground tabular-nums">
                      {c.litres.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-foreground tabular-nums">
                      ${c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                      ${c.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td
                      className="py-2.5 text-right font-medium tabular-nums"
                      style={{ color: c.profit >= 0 ? "#10B981" : "hsl(var(--destructive))" }}
                    >
                      ${c.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td
                      className="py-2.5 text-right tabular-nums"
                      style={{ color: c.margin >= 0 ? "#10B981" : "hsl(var(--destructive))" }}
                    >
                      {c.margin.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="font-semibold border-t border-border">
                  <td className="py-2.5 text-foreground">Total</td>
                  <td className="py-2.5 text-right text-foreground tabular-nums">
                    {totalLitres.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-foreground tabular-nums">
                    ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                    ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className="py-2.5 text-right tabular-nums"
                    style={{ color: grossProfit >= 0 ? "#10B981" : "hsl(var(--destructive))" }}
                  >
                    ${grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className="py-2.5 text-right tabular-nums"
                    style={{ color: grossMargin >= 0 ? "#10B981" : "hsl(var(--destructive))" }}
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
