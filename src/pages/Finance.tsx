import { useState } from "react";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices, useUpsertBuyPrice, useDeleteBuyPrice } from "@/hooks/useBuyPrices";
import { toast } from "sonner";
import PricingTab from "@/components/finance/PricingTab";
import ClientPricingTab from "@/components/finance/ClientPricingTab";
import { useCustomerPricing, getBlendedMargin } from "@/hooks/useCustomerPricing";

const tabs = ["P&L Overview", "Buy Price", "Client Pricing", "Pricing"] as const;
type Tab = (typeof tabs)[number];

export default function Finance() {
  const [activeTab, setActiveTab] = useState<Tab>("P&L Overview");

  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      {/* Tab strip */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[13px] bg-transparent border-none cursor-pointer transition-all -mb-px ${
              activeTab === tab
                ? "font-medium text-foreground border-b-2 border-primary"
                : "font-normal text-muted-foreground border-b-2 border-transparent"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "P&L Overview" && <PLOverview />}
      {activeTab === "Buy Price" && <BuyPriceTab />}
      {activeTab === "Client Pricing" && <ClientPricingTab />}
      {activeTab === "Pricing" && <PricingTab />}
    </div>
  );
}

function PLOverview() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: previous = [] } = usePreviousTransactions(range);
  const { data: buyPrices = [] } = useBuyPrices(365);

  if (isLoading) {
    return <div className="text-muted-foreground text-[13px] py-16 text-center">Loading…</div>;
  }

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const totalRevenue = filtered.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const numDeliveries = filtered.length;

  const prevLitres = previous.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevRevenue = previous.reduce((s, t) => s + (t.dinero_total || 0), 0);

  const latestBuyPrice = buyPrices[0]?.price_per_litre || 0;
  const totalCost = totalLitres * latestBuyPrice;
  const profit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const pct = (c: number, p: number) => (p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100);
  const rangeLabel = range === "today" ? "Today" : range === "week" ? "This Week" : "This Month";

  const kpis = [
    {
      label: "Revenue (Ex GST)",
      value: "$" + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${rangeLabel} · sell price × litres`,
      pct: pct(totalRevenue, prevRevenue),
    },
    {
      label: "Litres Delivered",
      value: totalLitres.toLocaleString() + "L",
      sub: rangeLabel,
      pct: pct(totalLitres, prevLitres),
    },
    { label: "Deliveries", value: numDeliveries.toString(), sub: rangeLabel, pct: pct(numDeliveries, previous.length) },
    {
      label: "Buy Price (Latest)",
      value: latestBuyPrice > 0 ? `$${latestBuyPrice.toFixed(4)}/L` : "—",
      sub: buyPrices[0]?.price_date ? `Set ${format(parseISO(buyPrices[0].price_date), "dd MMM")}` : "Not set",
      pct: null,
    },
    {
      label: "Profit (Markup)",
      value: "$" + profit.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sub: `${rangeLabel} · revenue minus cost`,
      pct: null,
      positive: profit >= 0,
    },
    {
      label: "Profit Margin",
      value: profitMargin.toFixed(1) + "%",
      sub: "Profit ÷ revenue",
      pct: null,
      positive: profitMargin >= 0,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="text-[10px] font-medium text-[#999999] uppercase tracking-wider mb-2">
              {k.label}
            </div>
            <div
              className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums"
              style={{
                color: k.positive === false ? "#EF4444" : k.positive === true ? "#10B981" : "#ffffff",
              }}
            >
              {k.value}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              {k.pct !== null && (
                <span
                  className="text-[11px] flex items-center gap-1"
                  style={{ color: k.pct >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {k.pct >= 0 ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  {k.pct >= 0 ? "+" : ""}
                  {k.pct.toFixed(1)}%
                </span>
              )}
              <span className="text-[11px] text-[#999999]">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuyPriceTab() {
  const { data: prices = [], isLoading } = useBuyPrices(365);
  const upsert = useUpsertBuyPrice();
  const del = useDeleteBuyPrice();

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [price, setPrice] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const handleSave = async () => {
    const p = parseFloat(price);
    if (!date || isNaN(p) || p <= 0) {
      toast.error("Enter a valid date and price");
      return;
    }
    try {
      await upsert.mutateAsync({ price_date: date, price_per_litre: p });
      toast.success(`Saved $${p.toFixed(4)}/L for ${format(parseISO(date), "dd MMM yyyy")}`);
      setPrice("");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleBulkSave = async () => {
    const lines = bulkText.trim().split("\n").filter(Boolean);
    let saved = 0;
    for (const line of lines) {
      const parts = line.split(",").map((s) => s.trim());
      if (parts.length < 2) continue;
      const [d, p] = parts;
      const parsed = parseFloat(p);
      if (!d || isNaN(parsed)) continue;
      try {
        await upsert.mutateAsync({ price_date: d, price_per_litre: parsed });
        saved++;
      } catch {
        /* skip bad lines */
      }
    }
    toast.success(`Saved ${saved} entries`);
    setBulkText("");
    setShowBulk(false);
  };

  const chartData = [...prices].reverse().map((p) => ({
    date: format(parseISO(p.price_date), "dd MMM"),
    price: p.price_per_litre,
  }));

  const latest = prices[0];
  const prev = prices[1];
  const priceChange = latest && prev ? latest.price_per_litre - prev.price_per_litre : null;
  const avgPrice = prices.length > 0 ? prices.reduce((s, p) => s + p.price_per_litre, 0) / prices.length : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Today's price hero */}
      {latest && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-[10px] text-[#aaaaaa] uppercase tracking-wider mb-1.5">
              Today's Buy Price — Pacific
            </div>
            <div className="text-3xl sm:text-[44px] font-light text-foreground tracking-tighter tabular-nums">
              ${latest.price_per_litre.toFixed(4)}
              <span className="text-base sm:text-lg text-[#aaaaaa]">/L</span>
            </div>
            {priceChange !== null && (
              <div className="flex items-center gap-1.5 mt-2">
                {priceChange >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-destructive" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-positive" />
                )}
                <span className={`text-xs font-medium ${priceChange >= 0 ? "text-destructive" : "text-positive"}`}>
                  {priceChange >= 0 ? "+" : ""}${priceChange.toFixed(4)}/L
                </span>
                <span className="text-xs text-[#999999]">from previous entry</span>
              </div>
            )}
          </div>
          <div className="sm:text-right">
            <div className="text-[10px] text-[#999999] uppercase tracking-wider mb-1">365-day avg</div>
            <div className="text-lg sm:text-xl font-medium text-[#aaaaaa] tabular-nums">
              ${avgPrice.toFixed(4)}/L
            </div>
          </div>
        </div>
      )}

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-[#aaaaaa] uppercase tracking-wider mb-4">
            Buy Price Trend — Last {prices.length} Entries
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#999999" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#999999" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v.toFixed(2)}`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111111",
                    border: "1px solid #7C3AED",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`$${v.toFixed(4)}/L`, "Buy Price"]}
                  cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                />
                {avgPrice > 0 && (
                  <ReferenceLine
                    y={avgPrice}
                    stroke="#555555"
                    strokeDasharray="4 4"
                    label={{ value: "avg", fill: "#aaaaaa", fontSize: 9 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  dot={{ fill: "#7C3AED", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#7C3AED" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quick entry */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-[#aaaaaa] uppercase tracking-wider mb-3.5">
          Quick Entry
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-[#aaaaaa]">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground px-3 py-2 text-[13px] outline-none w-full sm:w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-[#aaaaaa]">Buy Price / Litre ($)</label>
            <input
              type="number"
              step="0.0001"
              placeholder="e.g. 2.5400"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground px-3 py-2 text-[13px] outline-none w-full sm:w-44"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-70"
            >
              {upsert.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="bg-transparent text-[#aaaaaa] border border-[#2a2a2a] rounded-full px-4 py-2 text-xs cursor-pointer"
            >
              {showBulk ? "Hide Bulk" : "Bulk Backfill"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#999999] mt-2">Press Enter to save instantly</p>

        {/* Bulk backfill */}
        {showBulk && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="text-[11px] text-[#aaaaaa]">
              One entry per line: <span className="text-[#bbbbbb]">YYYY-MM-DD, price</span> — e.g.{" "}
              <span className="text-[#cccccc]">2026-03-01, 2.1520</span>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"2026-03-01, 2.1520\n2026-03-06, 1.8022\n2026-03-09, 1.9831"}
              rows={8}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground p-3 text-xs font-mono outline-none resize-y w-full"
            />
            <button
              onClick={handleBulkSave}
              disabled={upsert.isPending}
              className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2 text-xs font-semibold cursor-pointer self-start"
            >
              Save All Entries
            </button>
          </div>
        )}
      </div>

      {/* Price history */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-[#aaaaaa] uppercase tracking-wider mb-3.5">
          Price History ({prices.length} entries)
        </div>
        {isLoading ? (
          <div className="text-[#999999] text-[13px]">Loading…</div>
        ) : prices.length === 0 ? (
          <div className="text-[#999999] text-[13px]">No entries yet. Add your first buy price above.</div>
        ) : (
          <div className="flex flex-col">
            {prices.map((p, i) => {
              const next = prices[i + 1];
              const change = next ? p.price_per_litre - next.price_per_litre : null;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: i < prices.length - 1 ? "1px solid #1a1a1a" : "none" }}
                >
                  <div>
                    <div className="text-[13px] text-[#dddddd] font-medium">
                      {format(parseISO(p.price_date), "EEE dd MMM yyyy")}
                    </div>
                    <div className="text-[11px] text-[#999999] mt-0.5">{p.supplier}</div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-right">
                      <div className="text-[15px] font-semibold text-foreground tabular-nums">
                        ${p.price_per_litre.toFixed(4)}/L
                      </div>
                      {change !== null && (
                        <div className={`text-[11px] mt-0.5 ${change >= 0 ? "text-destructive" : "text-positive"}`}>
                          {change >= 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(4)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => del.mutate(p.id)}
                      className="bg-transparent border-none cursor-pointer text-[#777777] hover:text-destructive p-1 transition-colors"
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
