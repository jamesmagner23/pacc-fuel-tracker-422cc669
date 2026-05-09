import { useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend } from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBuyPrices, useTodayBuyPrices, SUPPLIERS } from "@/hooks/useBuyPrices";
import { useTGPrices } from "@/hooks/useTGPrices";
import { TrendingDown, TrendingUp, Trophy, RefreshCw, Mail } from "lucide-react";
import { toast } from "sonner";

const SUPPLIER_COLORS: Record<string, string> = {
  Pacific: "var(--accent)",
  "Pro Fusion": "#1E3A8A",
};
const DIFF_COLOR = "#9C6ADE";
const FALLBACK = ["#E0A458", "#9C6ADE", "#48B5A6", "#D96C6C"];
const colorFor = (s: string, i = 0) => SUPPLIER_COLORS[s] || FALLBACK[i % FALLBACK.length];
const GST = 1.1;

interface SupplierPurchase {
  id: string;
  purchase_date: string;
  supplier: string;
  litres: number;
  price_per_litre_ex_gst: number;
  total_ex_gst: number;
  invoice_ref: string | null;
  notes: string | null;
}

interface ScrapeLog {
  id: string;
  scraped_at: string;
  supplier: string | null;
  status: string;
  price_per_litre: number | null;
  price_date: string | null;
  error: string | null;
}

export default function Suppliers() {
  const qc = useQueryClient();
  const [showInc, setShowInc] = useState(false);
  const [days, setDays] = useState(30);
  const { data: prices = [] } = useBuyPrices(days);
  const { data: todayPrices = [] } = useTodayBuyPrices();
  const { data: tgp = [] } = useTGPrices("Melbourne", "Diesel", days);
  const [running, setRunning] = useState(false);

  const purchasesQ = useQuery({
    queryKey: ["supplier-purchases", days],
    queryFn: async () => {
      const since = format(subDays(new Date(), days), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("supplier_purchases" as any)
        .select("*")
        .gte("purchase_date", since)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SupplierPurchase[];
    },
  });

  const scrapeLogQ = useQuery({
    queryKey: ["supplier-scrape-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_price_scrape_log" as any)
        .select("*")
        .order("scraped_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as unknown as ScrapeLog[];
    },
  });

  // Snapshot
  const todaySorted = [...todayPrices].sort((a, b) => a.price_per_litre - b.price_per_litre);
  const cheapest = todaySorted[0];
  const dearest = todaySorted[todaySorted.length - 1];
  const todayDelta = cheapest && dearest && cheapest.id !== dearest.id
    ? dearest.price_per_litre - cheapest.price_per_litre : null;

  // Trend chart data (one row per date, columns per supplier)
  const allSuppliers = Array.from(new Set([...SUPPLIERS, ...prices.map(p => p.supplier)].filter(Boolean)));
  const trendData = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    [...prices].reverse().forEach(p => {
      const key = format(parseISO(p.price_date), "dd MMM");
      const row = map.get(key) || { date: key };
      const v = showInc ? p.price_per_litre * GST : p.price_per_litre;
      row[p.supplier] = Number(v.toFixed(4));
      map.set(key, row);
    });
    // Compute |Pacific − Pro Fusion| per row so we can draw a difference line.
    return Array.from(map.values()).map((row) => {
      const a = row["Pacific"];
      const b = row["Pro Fusion"];
      if (typeof a === "number" && typeof b === "number") {
        row["diff"] = Number(Math.abs(a - b).toFixed(4));
      }
      return row;
    });
  }, [prices, showInc]);

  // Spread vs TGP chart
  const tgpSpread = useMemo(() => {
    const tgpMap = new Map(tgp.map(t => [t.price_date, t.price_per_litre / GST])); // ex GST
    const dates = Array.from(new Set([...prices.map(p => p.price_date), ...tgp.map(t => t.price_date)])).sort();
    return dates.map(d => {
      const row: Record<string, any> = { date: format(parseISO(d), "dd MMM"), tgp: tgpMap.get(d) ?? null };
      allSuppliers.forEach(s => {
        const p = prices.find(x => x.price_date === d && x.supplier === s);
        if (p && tgpMap.has(d)) row[`${s}_spread`] = Number((p.price_per_litre - (tgpMap.get(d) as number)).toFixed(4));
      });
      return row;
    });
  }, [prices, tgp, allSuppliers]);

  // Volume & spend per supplier
  const volSpend = useMemo(() => {
    const map = new Map<string, { litres: number; spend: number }>();
    (purchasesQ.data || []).forEach(p => {
      const cur = map.get(p.supplier) || { litres: 0, spend: 0 };
      cur.litres += Number(p.litres);
      cur.spend += Number(p.total_ex_gst);
      map.set(p.supplier, cur);
    });
    return Array.from(map.entries()).map(([supplier, v]) => ({
      supplier,
      litres: Math.round(v.litres),
      spend: Math.round(v.spend),
      avg: v.litres > 0 ? v.spend / v.litres : 0,
    }));
  }, [purchasesQ.data]);

  const handleRunScrape = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-supplier-prices");
      if (error) throw error;
      toast.success("Scraper run complete");
      qc.invalidateQueries({ queryKey: ["buy-prices"] });
      qc.invalidateQueries({ queryKey: ["buy-prices-today-all"] });
      qc.invalidateQueries({ queryKey: ["supplier-scrape-log"] });
      console.log("scrape result", data);
    } catch (e) {
      toast.error("Scrape failed — check the log");
    } finally {
      setRunning(false);
    }
  };

  // Add purchase form
  const [pf, setPf] = useState<{ purchase_date: string; supplier: string; litres: string; price: string; invoice: string }>({
    purchase_date: format(new Date(), "yyyy-MM-dd"),
    supplier: SUPPLIERS[0],
    litres: "",
    price: "",
    invoice: "",
  });
  const addPurchase = useMutation({
    mutationFn: async () => {
      const litres = parseFloat(pf.litres);
      const price = parseFloat(pf.price);
      if (!litres || !price) throw new Error("Enter litres and price");
      const { error } = await supabase.from("supplier_purchases" as any).insert({
        purchase_date: pf.purchase_date, supplier: pf.supplier,
        litres, price_per_litre_ex_gst: price, invoice_ref: pf.invoice || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase logged");
      setPf({ ...pf, litres: "", price: "", invoice: "" });
      qc.invalidateQueries({ queryKey: ["supplier-purchases"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return (
    <div className="flex flex-col gap-4 max-w-[1200px]">
      {/* Header / actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Suppliers</h1>
          <p className="text-xs text-muted-foreground mt-1">Pacific & Pro Fusion daily pricing, volumes & spend</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface border border-surface-border rounded-full p-1">
            <button onClick={() => setShowInc(false)} className={`px-3 py-1 text-[11px] rounded-full ${!showInc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Ex GST</button>
            <button onClick={() => setShowInc(true)} className={`px-3 py-1 text-[11px] rounded-full ${showInc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Inc GST</button>
          </div>
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="bg-surface border border-surface-border rounded-full text-foreground px-3 py-1 text-[11px] outline-none">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
          <button onClick={handleRunScrape} disabled={running} className="bg-primary text-primary-foreground rounded-full px-4 py-1.5 text-[11px] font-medium flex items-center gap-1.5 disabled:opacity-60">
            <RefreshCw className={`w-3 h-3 ${running ? "animate-spin" : ""}`} />
            {running ? "Scraping…" : "Scrape Gmail now"}
          </button>
        </div>
      </div>

      {/* Today snapshot */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Today's Snapshot</div>
          {cheapest && (
            <div className="text-[11px] text-positive font-medium flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Cheapest: {cheapest.supplier}
              {todayDelta != null && <span className="text-muted-foreground ml-1">— saves ${todayDelta.toFixed(4)}/L</span>}
            </div>
          )}
        </div>
        {todaySorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">No prices recorded today yet. The scraper runs at 12:00pm daily, or click <span className="text-foreground">Scrape Gmail now</span>.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {todaySorted.map((p, i) => {
              const isBest = cheapest && p.id === cheapest.id && todaySorted.length > 1;
              const value = showInc ? p.price_per_litre * GST : p.price_per_litre;
              return (
                <div key={p.id} className={`rounded-lg border p-4 ${isBest ? "border-positive/50 bg-positive/5" : "border-surface-border"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[12px] text-foreground font-medium flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorFor(p.supplier, i) }} />
                      {p.supplier}
                    </div>
                    {isBest && <div className="text-[9px] uppercase tracking-wider text-positive font-semibold">Recommended</div>}
                  </div>
                  <div className="text-2xl font-semibold text-foreground tabular-nums">${value.toFixed(4)}<span className="text-xs text-muted-foreground">/L {showInc ? "inc" : "ex"} GST</span></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily Buy Price — {showInc ? "Inc" : "Ex"} GST</div>
            <div className="flex items-center gap-3 flex-wrap">
              {allSuppliers.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: colorFor(s, i) }} />
                  <span className="text-[10px] text-muted-foreground">{s}</span>
                </div>
              ))}
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: DIFF_COLOR, opacity: 0.5 }} />
              <span className="text-[10px] text-muted-foreground">Difference</span>
            </div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} barCategoryGap="20%" barGap={2}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="price" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                <YAxis yAxisId="diff" orientation="right" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(3)}`} domain={[0, "auto"]} />
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 11 }} formatter={(v: number, n: string) => [`$${v.toFixed(4)}/L`, n]} />
                {allSuppliers.map((s, i) => (
                  <Bar key={s} yAxisId="price" dataKey={s} fill={colorFor(s, i)} radius={[2, 2, 0, 0]} />
                ))}
                <Bar yAxisId="diff" dataKey="diff" name="Difference" fill={DIFF_COLOR} fillOpacity={0.5} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Spread vs TGP */}
      {tgpSpread.length > 1 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Spread vs Melbourne TGP (Ex GST) — negative = below TGP</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tgpSpread} barCategoryGap="20%" barGap={2}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v >= 0 ? "+" : ""}$${v.toFixed(3)}`} />
                <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="3 3" />
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 11 }} formatter={(v: number, n: string) => [`${v >= 0 ? "+" : ""}$${v.toFixed(4)}/L`, n.replace("_spread", "")]} />
                {allSuppliers.map((s, i) => (
                  <Bar key={s} dataKey={`${s}_spread`} fill={colorFor(s, i)} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Volume & spend */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Volume & Spend per Supplier — Last {days} days</div>
        </div>
        {volSpend.length === 0 ? (
          <div className="text-sm text-muted-foreground">No purchases logged yet. Use the form below to record what you actually bought from each supplier.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {volSpend.map((v, i) => (
                <div key={v.supplier} className="rounded-lg border border-surface-border p-3">
                  <div className="text-[12px] text-foreground font-medium flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorFor(v.supplier, i) }} />
                    {v.supplier}
                  </div>
                  <div className="text-xl font-semibold text-foreground tabular-nums mt-1">{v.litres.toLocaleString()}<span className="text-xs text-muted-foreground"> L</span></div>
                  <div className="text-[12px] text-muted-foreground tabular-nums mt-0.5">${v.spend.toLocaleString()} ex GST · avg ${v.avg.toFixed(4)}/L</div>
                </div>
              ))}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volSpend}>
                  <XAxis dataKey="supplier" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="litres" name="Litres" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spend" name="Spend $" fill="#5B9BD5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Log a purchase */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Log a Purchase</div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Date</label>
            <input type="date" value={pf.purchase_date} onChange={(e) => setPf({ ...pf, purchase_date: e.target.value })} className="bg-raised border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Supplier</label>
            <select value={pf.supplier} onChange={(e) => setPf({ ...pf, supplier: e.target.value })} className="bg-raised border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none">
              {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Litres</label>
            <input type="number" value={pf.litres} onChange={(e) => setPf({ ...pf, litres: e.target.value })} placeholder="e.g. 8000" className="bg-raised border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none w-32" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Price/L ex GST</label>
            <input type="number" step="0.0001" value={pf.price} onChange={(e) => setPf({ ...pf, price: e.target.value })} placeholder="e.g. 1.8400" className="bg-raised border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none w-32" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted-foreground">Invoice (optional)</label>
            <input value={pf.invoice} onChange={(e) => setPf({ ...pf, invoice: e.target.value })} className="bg-raised border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none w-40" />
          </div>
          <button onClick={() => addPurchase.mutate()} disabled={addPurchase.isPending} className="bg-primary text-primary-foreground rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-60">
            {addPurchase.isPending ? "Saving…" : "Save Purchase"}
          </button>
        </div>
      </div>

      {/* Scrape log */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Mail className="w-3 h-3" /> Recent Gmail Scrape Attempts</div>
        </div>
        {(scrapeLogQ.data || []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No scrape attempts yet. The scheduler runs daily at 12:00pm.</div>
        ) : (
          <div className="flex flex-col">
            {(scrapeLogQ.data || []).map((l, i, arr) => (
              <div key={l.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--surface-border)" : "none" }}>
                <div className="min-w-0">
                  <div className="text-[13px] text-foreground font-medium">{l.supplier || "—"} <span className={`ml-2 text-[10px] uppercase tracking-wider ${l.status === "success" ? "text-positive" : "text-destructive"}`}>{l.status}</span></div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{format(parseISO(l.scraped_at), "dd MMM HH:mm")} {l.error ? `· ${l.error}` : ""}</div>
                </div>
                {l.price_per_litre != null && (
                  <div className="text-[13px] text-foreground tabular-nums">${Number(l.price_per_litre).toFixed(4)}/L</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}