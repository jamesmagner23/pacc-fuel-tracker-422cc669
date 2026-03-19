import { useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Droplets, Truck, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices, useUpsertBuyPrice, useDeleteBuyPrice } from "@/hooks/useBuyPrices";
import { toast } from "sonner";

const tabs = ["P&L Overview", "Buy Price"] as const;
type Tab = (typeof tabs)[number];

const card: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid #161616",
  borderRadius: 10,
  padding: "18px 20px",
};

export default function Finance() {
  const [activeTab, setActiveTab] = useState<Tab>("P&L Overview");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      {/* Tab strip */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #161616", paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: activeTab === tab ? 500 : 400,
              color: activeTab === tab ? "#ffffff" : "#444444",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #7C3AED" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "P&L Overview" && <PLOverview />}
      {activeTab === "Buy Price" && <BuyPriceTab />}
    </div>
  );
}

function PLOverview() {
  const { range } = useDateRange();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: previous = [] } = usePreviousTransactions(range);
  const { data: buyPrices = [] } = useBuyPrices(365);

  if (isLoading) {
    return <div style={{ color: "#444444", fontSize: 13, padding: "60px 0", textAlign: "center" }}>Loading…</div>;
  }

  const totalLitres = filtered.reduce((s, t) => s + (t.cantidad || 0), 0);
  const totalRevenue = filtered.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const numDeliveries = filtered.length;

  const prevLitres = previous.reduce((s, t) => s + (t.cantidad || 0), 0);
  const prevRevenue = previous.reduce((s, t) => s + (t.dinero_total || 0), 0);

  // Use most recent buy price
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {kpis.map((k) => (
          <div key={k.label} style={card}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "#444444",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 10,
              }}
            >
              {k.label}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: k.positive === false ? "#EF4444" : k.positive === true ? "#10B981" : "#ffffff",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {k.value}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              {k.pct !== null && (
                <span
                  style={{
                    fontSize: 11,
                    color: k.pct >= 0 ? "#10B981" : "#EF4444",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  {k.pct >= 0 ? (
                    <TrendingUp style={{ width: 10, height: 10 }} />
                  ) : (
                    <TrendingDown style={{ width: 10, height: 10 }} />
                  )}
                  {k.pct >= 0 ? "+" : ""}
                  {k.pct.toFixed(1)}%
                </span>
              )}
              <span style={{ fontSize: 11, color: "#333333" }}>{k.sub}</span>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Today's price hero */}
      {latest && (
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontSize: 10,
                color: "#444444",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 6,
              }}
            >
              Today's Buy Price — Pacific
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 300,
                color: "#ffffff",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ${latest.price_per_litre.toFixed(4)}
              <span style={{ fontSize: 18, color: "#444444" }}>/L</span>
            </div>
            {priceChange !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                {priceChange >= 0 ? (
                  <TrendingUp style={{ width: 12, height: 12, color: "#EF4444" }} />
                ) : (
                  <TrendingDown style={{ width: 12, height: 12, color: "#10B981" }} />
                )}
                <span style={{ fontSize: 12, color: priceChange >= 0 ? "#EF4444" : "#10B981", fontWeight: 500 }}>
                  {priceChange >= 0 ? "+" : ""}${priceChange.toFixed(4)}/L
                </span>
                <span style={{ fontSize: 12, color: "#333333" }}>from previous entry</span>
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 10,
                color: "#333333",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 4,
              }}
            >
              365-day avg
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: "#888888", fontVariantNumeric: "tabular-nums" }}>
              ${avgPrice.toFixed(4)}/L
            </div>
          </div>
        </div>
      )}

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div style={card}>
          <div
            style={{
              fontSize: 10,
              color: "#444444",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 16,
            }}
          >
            Buy Price Trend — Last {prices.length} Entries
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#333333" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#333333" }}
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
                    stroke="#333333"
                    strokeDasharray="4 4"
                    label={{ value: "avg", fill: "#444444", fontSize: 9 }}
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
      <div style={card}>
        <div
          style={{
            fontSize: 10,
            color: "#444444",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: 14,
          }}
        >
          Quick Entry
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, color: "#444444" }}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                background: "#1a1a1a",
                border: "1px solid #222222",
                borderRadius: 8,
                color: "#ffffff",
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                width: 160,
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, color: "#444444" }}>Buy Price / Litre ($)</label>
            <input
              type="number"
              step="0.0001"
              placeholder="e.g. 2.5400"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              style={{
                background: "#1a1a1a",
                border: "1px solid #222222",
                borderRadius: 8,
                color: "#ffffff",
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                width: 180,
              }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            style={{
              background: "#7C3AED",
              color: "#ffffff",
              border: "none",
              borderRadius: 20,
              padding: "9px 20px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              opacity: upsert.isPending ? 0.7 : 1,
            }}
          >
            {upsert.isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setShowBulk(!showBulk)}
            style={{
              background: "transparent",
              color: "#444444",
              border: "1px solid #222222",
              borderRadius: 20,
              padding: "9px 16px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {showBulk ? "Hide Bulk" : "Bulk Backfill"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "#333333", marginTop: 8 }}>Press Enter to save instantly</p>

        {/* Bulk backfill */}
        {showBulk && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#444444" }}>
              One entry per line: <span style={{ color: "#555555" }}>YYYY-MM-DD, price</span> — e.g.{" "}
              <span style={{ color: "#666666" }}>2026-03-01, 2.1520</span>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"2026-03-01, 2.1520\n2026-03-06, 1.8022\n2026-03-09, 1.9831"}
              rows={8}
              style={{
                background: "#1a1a1a",
                border: "1px solid #222222",
                borderRadius: 8,
                color: "#ffffff",
                padding: "10px 12px",
                fontSize: 12,
                fontFamily: "monospace",
                outline: "none",
                resize: "vertical",
                width: "100%",
              }}
            />
            <button
              onClick={handleBulkSave}
              disabled={upsert.isPending}
              style={{
                background: "#7C3AED",
                color: "#ffffff",
                border: "none",
                borderRadius: 20,
                padding: "9px 20px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              Save All Entries
            </button>
          </div>
        )}
      </div>

      {/* Price history */}
      <div style={card}>
        <div
          style={{
            fontSize: 10,
            color: "#444444",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: 14,
          }}
        >
          Price History ({prices.length} entries)
        </div>
        {isLoading ? (
          <div style={{ color: "#333333", fontSize: 13 }}>Loading…</div>
        ) : prices.length === 0 ? (
          <div style={{ color: "#333333", fontSize: 13 }}>No entries yet. Add your first buy price above.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {prices.map((p, i) => {
              const next = prices[i + 1];
              const change = next ? p.price_per_litre - next.price_per_litre : null;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: i < prices.length - 1 ? "1px solid #131313" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "#cccccc", fontWeight: 500 }}>
                      {format(parseISO(p.price_date), "EEE dd MMM yyyy")}
                    </div>
                    <div style={{ fontSize: 11, color: "#333333", marginTop: 2 }}>{p.supplier}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{ fontSize: 15, fontWeight: 600, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}
                      >
                        ${p.price_per_litre.toFixed(4)}/L
                      </div>
                      {change !== null && (
                        <div style={{ fontSize: 11, color: change >= 0 ? "#EF4444" : "#10B981", marginTop: 2 }}>
                          {change >= 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(4)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => del.mutate(p.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#2a2a2a",
                        padding: 4,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#2a2a2a")}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
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
