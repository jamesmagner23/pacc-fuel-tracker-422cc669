import { useState } from "react";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Trash2, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useBuyPrices, useUpsertBuyPrice, useDeleteBuyPrice } from "@/hooks/useBuyPrices";
import { useTGPrices, useTodayTGP, useFetchTGP } from "@/hooks/useTGPrices";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/hooks/useDemo";
import { DEMO_FUEL_INTAKE_LOGS } from "@/data/demoData";
import { toast } from "sonner";

export default function BuyPriceTab() {
  const queryClient = useQueryClient();
  const { data: prices = [], isLoading } = useBuyPrices(365);
  const upsert = useUpsertBuyPrice();
  const del = useDeleteBuyPrice();
  const { data: tgpPrices = [] } = useTGPrices("Melbourne", "Diesel", 30);
  const { data: todayTGP } = useTodayTGP("Melbourne", "Diesel");
  const fetchTGP = useFetchTGP();
  const [refreshingTGP, setRefreshingTGP] = useState(false);

  const handleRefreshTGP = async () => {
    setRefreshingTGP(true);
    try {
      const result = await fetchTGP();
      toast.success(`TGP updated — ${result.records_upserted} records synced`);
      queryClient.invalidateQueries({ queryKey: ["tgp"] });
      queryClient.invalidateQueries({ queryKey: ["tgp-today"] });
    } catch {
      toast.error("Failed to fetch TGP data");
    } finally {
      setRefreshingTGP(false);
    }
  };

  const isDemo = useDemo();

  // Latest bowser retail price from driver intake logs
  const bowserRetailQuery = useQuery({
    queryKey: ["bowser-retail-latest", isDemo],
    queryFn: async () => {
      if (isDemo) {
        const log = DEMO_FUEL_INTAKE_LOGS.find(l => l.bowser_retail_price != null);
        return log ? { bowser_retail_price: log.bowser_retail_price, log_date: log.log_date, created_at: log.created_at } : null;
      }
      const { data, error } = await supabase
        .from("fuel_intake_logs")
        .select("bowser_retail_price, log_date, created_at")
        .not("bowser_retail_price", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
  });

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
      } catch { /* skip */ }
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
      {latest && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Today's Buy Price — Pacific</div>
            <div className="text-3xl sm:text-[44px] font-light text-foreground tracking-tighter tabular-nums">
              ${latest.price_per_litre.toFixed(4)}
              <span className="text-base sm:text-lg text-muted-foreground">/L</span>
            </div>
            {priceChange !== null && (
              <div className="flex items-center gap-1.5 mt-2">
                {priceChange >= 0 ? <TrendingUp className="w-3 h-3 text-destructive" /> : <TrendingDown className="w-3 h-3 text-positive" />}
                <span className={`text-xs font-medium ${priceChange >= 0 ? "text-destructive" : "text-positive"}`}>
                  {priceChange >= 0 ? "+" : ""}${priceChange.toFixed(4)}/L
                </span>
                <span className="text-xs text-muted-foreground">from previous entry</span>
              </div>
            )}
          </div>
          <div className="sm:text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">365-day avg</div>
            <div className="text-lg sm:text-xl font-medium text-muted-foreground tabular-nums">${avgPrice.toFixed(4)}/L</div>
          </div>
        </div>
      )}

      {/* TGP vs Buy Price comparison — only show when today's buy price has been entered */}
      {latest && latest.price_date !== format(new Date(), "yyyy-MM-dd") && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Terminal Gate Price vs Your Buy Price</div>
          <p className="text-sm text-muted-foreground">Enter today's buy price to see TGP comparison.</p>
        </div>
      )}
      {latest && latest.price_date === format(new Date(), "yyyy-MM-dd") && (() => {
        const GST = 1.1;
        const buy = latest.price_per_litre;
        const tgpIncGst = todayTGP?.price_per_litre;
        const tgp = tgpIncGst ? tgpIncGst / GST : null;
        const tgpDiff = tgp ? buy - tgp : null;
        const tgpPct = tgp && tgp > 0 ? ((tgpDiff! / tgp) * 100) : null;

        // Build overlay chart data — convert TGP to ex GST
        const tgpMap = new Map(tgpPrices.map(t => [t.price_date, t.price_per_litre / GST]));
        const buyMap = new Map(prices.slice(0, 30).map(p => [p.price_date, p.price_per_litre]));
        const allDates = [...new Set([...tgpMap.keys(), ...buyMap.keys()])].sort();
        const overlayData = allDates.map(d => ({
          date: format(parseISO(d), "dd MMM"),
          tgp: tgpMap.get(d) ?? null,
          buy: buyMap.get(d) ?? null,
        }));

        return (
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Terminal Gate Price vs Your Buy Price — Melbourne Diesel (All Ex GST)</div>
              <button
                onClick={handleRefreshTGP}
                disabled={refreshingTGP}
                className="bg-transparent border border-surface-border rounded-full px-3 py-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingTGP ? "animate-spin" : ""}`} />
                {refreshingTGP ? "Syncing…" : "Refresh TGP"}
              </button>
            </div>

            {tgp ? (
              <>
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Your Buy (Pacific)</div>
                    <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums">${buy.toFixed(4)}<span className="text-xs text-muted-foreground">/L</span></div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">ex GST</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Variance</div>
                    <div className={`text-xl sm:text-2xl font-semibold tabular-nums ${tgpDiff !== null && tgpDiff <= 0 ? "text-positive" : "text-destructive"}`}>
                      {tgpDiff !== null ? `${tgpDiff >= 0 ? "+" : ""}${tgpDiff.toFixed(4)}` : "—"}
                    </div>
                    {tgpPct !== null && (
                      <div className={`text-[11px] font-medium ${tgpDiff !== null && tgpDiff <= 0 ? "text-positive" : "text-destructive"}`}>
                        {tgpPct >= 0 ? "+" : ""}{tgpPct.toFixed(1)}% {tgpDiff !== null && tgpDiff <= 0 ? "below TGP" : "above TGP"}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">TGP (AIP Avg)</div>
                    <div className="text-xl sm:text-2xl font-semibold text-muted-foreground tabular-nums">${tgp.toFixed(4)}<span className="text-xs text-muted-foreground">/L</span></div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">ex GST (converted)</div>
                  </div>
                </div>

                {/* Overlay chart */}
                {overlayData.length > 1 && (
                  <div className="mt-4 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overlayData}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                          formatter={(v: number, name: string) => [`$${v?.toFixed(4)}/L ex GST`, name === "tgp" ? "TGP (AIP)" : "Your Buy"]}
                        />
                        <Line type="monotone" dataKey="tgp" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} connectNulls />
                        <Line type="monotone" dataKey="buy" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-4 mt-1">
                      <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-primary rounded" /><span className="text-[10px] text-muted-foreground">Your Buy (ex GST)</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-muted-foreground rounded" /><span className="text-[10px] text-muted-foreground">TGP (ex GST)</span></div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No TGP data for today. Click Refresh TGP to fetch latest pricing from AIP.</div>
            )}
          </div>
        );
      })()}

      {latest && bowserRetailQuery.data && (() => {
        const GST_DIVISOR = 1.1;
        const retailIncGst = Number(bowserRetailQuery.data.bowser_retail_price);
        const retail = retailIncGst / GST_DIVISOR; // convert to ex GST
        const buy = latest.price_per_litre;
        const diff = retail - buy;
        const pct = buy > 0 ? ((diff / buy) * 100) : 0;
        const logDate = bowserRetailQuery.data.log_date;
        return (
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3.5">Buy Price vs Bowser Retail (All Ex GST)</div>
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Your Buy (Pacific)</div>
                <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums">${buy.toFixed(4)}<span className="text-xs text-muted-foreground">/L</span></div>
                <div className="text-[10px] text-muted-foreground mt-0.5">ex GST</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Difference</div>
                <div className={`text-xl sm:text-2xl font-semibold tabular-nums ${diff >= 0 ? "text-positive" : "text-destructive"}`}>
                  {diff >= 0 ? "+" : ""}${diff.toFixed(4)}
                </div>
                <div className={`text-[11px] font-medium ${diff >= 0 ? "text-positive" : "text-destructive"}`}>
                  {diff >= 0 ? "+" : ""}{pct.toFixed(1)}% {diff >= 0 ? "margin" : "loss"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Bowser Retail</div>
                <div className="text-xl sm:text-2xl font-semibold text-muted-foreground tabular-nums">${retail.toFixed(4)}<span className="text-xs text-muted-foreground">/L</span></div>
                <div className="text-[10px] text-muted-foreground mt-0.5">ex GST</div>
                {logDate && <div className="text-[10px] text-muted-foreground mt-0.5">logged {format(parseISO(logDate), "dd MMM")}</div>}
              </div>
            </div>
            {/* Visual bar */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-foreground rounded-full" style={{ width: `${Math.min((buy / retail) * 100, 100)}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{((buy / retail) * 100).toFixed(1)}% of retail</span>
            </div>
          </div>
        );
      })()}

      {chartData.length > 1 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-4">Buy Price Trend — Last {prices.length} Entries</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--primary))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => [`$${v.toFixed(4)}/L`, "Buy Price"]}
                  cursor={{ stroke: "hsl(var(--muted-foreground) / 0.2)" }}
                />
                {avgPrice > 0 && <ReferenceLine y={avgPrice} stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth={1} />}
                <Line type="monotone" dataKey="price" stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "hsl(25, 95%, 53%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3.5">Quick Entry</div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none w-full sm:w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Buy Price / Litre ($)</label>
            <input type="number" step="0.0001" placeholder="e.g. 2.5400" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none w-full sm:w-44" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={upsert.isPending} className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-70">
              {upsert.isPending ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setShowBulk(!showBulk)} className="bg-transparent text-muted-foreground border border-surface-border rounded-full px-4 py-2 text-xs cursor-pointer">
              {showBulk ? "Hide Bulk" : "Bulk Backfill"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Press Enter to save instantly</p>

        {showBulk && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="text-[11px] text-muted-foreground">
              One entry per line: <span className="text-foreground/70">YYYY-MM-DD, price</span>
            </div>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"2026-03-01, 2.1520\n2026-03-06, 1.8022"} rows={8} className="bg-[hsl(var(--muted))] border border-surface-border rounded-lg text-foreground p-3 text-xs font-mono outline-none resize-y w-full" />
            <button onClick={handleBulkSave} disabled={upsert.isPending} className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2 text-xs font-semibold cursor-pointer self-start">
              Save All Entries
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3.5">Price History ({prices.length} entries)</div>
        {isLoading ? (
          <div className="text-muted-foreground text-[13px]">Loading…</div>
        ) : prices.length === 0 ? (
          <div className="text-muted-foreground text-[13px]">No entries yet.</div>
        ) : (
          <div className="flex flex-col">
            {prices.map((p, i) => {
              const next = prices[i + 1];
              const change = next ? p.price_per_litre - next.price_per_litre : null;
              return (
                <div key={p.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < prices.length - 1 ? "1px solid hsl(var(--border))" : "none" }}>
                  <div>
                    <div className="text-[13px] text-foreground font-medium">{format(parseISO(p.price_date), "EEE dd MMM yyyy")}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.supplier}</div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-right">
                      <div className="text-[15px] font-semibold text-foreground tabular-nums">${p.price_per_litre.toFixed(4)}/L</div>
                      {change !== null && (
                        <div className={`text-[11px] mt-0.5 ${change >= 0 ? "text-destructive" : "text-positive"}`}>
                          {change >= 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(4)}
                        </div>
                      )}
                    </div>
                    <button onClick={() => del.mutate(p.id)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1 transition-colors">
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
