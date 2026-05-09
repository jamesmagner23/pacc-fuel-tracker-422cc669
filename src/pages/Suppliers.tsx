import { useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBuyPrices, useTodayBuyPrices, SUPPLIERS } from "@/hooks/useBuyPrices";
import { useTGPrices } from "@/hooks/useTGPrices";
import { Trophy, RefreshCw, Mail, Gauge } from "lucide-react";
import { toast } from "sonner";

const SUPPLIER_COLORS: Record<string, string> = {
  Pacific: "var(--accent)",
  "Pro Fusion": "#1E3A8A",
};
const DIFF_COLOR = "#9C6ADE";
const FALLBACK = ["#E0A458", "#9C6ADE", "#48B5A6", "#D96C6C"];
const colorFor = (s: string, i = 0) => SUPPLIER_COLORS[s] || FALLBACK[i % FALLBACK.length];
const GST = 1.1;

/** Custom tooltip used by both supplier price charts. Shows per-supplier
 *  value plus the email-sent date and AI date-phrase reason from the scrape log. */
function PriceTooltip({ active, payload, label, suffix = "", stripSuffix, signed }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  const meta = (row._meta || {}) as Record<string, { sent: string; reason: string | null }>;
  const effectiveDate = row._iso ? format(parseISO(row._iso), "EEE dd MMM yyyy") : label;
  return (
    <div className="bg-background border border-surface-border rounded-lg shadow-lg p-2.5 min-w-[220px] max-w-[300px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Effective {effectiveDate}</div>
      {payload.map((p: any) => {
        const key = stripSuffix ? String(p.dataKey).replace(stripSuffix, "") : String(p.dataKey);
        if (key === "diff") {
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-3 py-1 border-t border-surface-border/60 mt-1 pt-1.5">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.fill, opacity: 0.6 }} />
                Difference
              </span>
              <span className="text-[11px] tabular-nums text-foreground">${Number(p.value).toFixed(4)}</span>
            </div>
          );
        }
        const v = Number(p.value);
        const valStr = `${signed && v >= 0 ? "+" : ""}$${v.toFixed(4)}${suffix}`;
        const m = meta[key];
        return (
          <div key={p.dataKey} className="py-1">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[12px] text-foreground">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.fill }} />
                {key}
              </span>
              <span className="text-[12px] tabular-nums text-foreground font-medium">{valStr}</span>
            </div>
            {m && (
              <div className="ml-3.5 mt-0.5 space-y-0.5">
                <div className="text-[10px] text-muted-foreground">Email sent {format(parseISO(m.sent), "dd MMM HH:mm")}</div>
                {m.reason && <div className="text-[10px] text-muted-foreground italic line-clamp-2">"{m.reason}"</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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
  // Reference Viva Energy Australia's published Melbourne diesel TGP
  // (scraped daily by the fetch-viva-tgp edge function).
  const { data: tgp = [] } = useTGPrices("Melbourne", "Diesel", days, "Viva");
  const [running, setRunning] = useState(false);

  // Reconciliation source: driver-recorded bowser intake (litres + bowser
  // retail price). Each intake is attributed to whichever supplier had the
  // cheapest scraped buy price on that date.
  const intakeQ = useQuery({
    queryKey: ["fuel-intake-recon", days],
    queryFn: async () => {
      const since = format(subDays(new Date(), days), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("fuel_intake_logs")
        .select("id, log_date, litres_entered, bowser_retail_price, notes")
        .gte("log_date", since)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Audit filters
  const [auditFrom, setAuditFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [auditTo, setAuditTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [auditSupplier, setAuditSupplier] = useState<string>("all");
  const [auditStatus, setAuditStatus] = useState<string>("all");

  const scrapeLogQ = useQuery({
    queryKey: ["supplier-scrape-log", auditFrom, auditTo, auditSupplier, auditStatus],
    queryFn: async () => {
      let q = supabase
        .from("supplier_price_scrape_log" as any)
        .select("*")
        .gte("scraped_at", `${auditFrom}T00:00:00Z`)
        .lte("scraped_at", `${auditTo}T23:59:59Z`)
        .order("scraped_at", { ascending: false })
        .limit(500);
      if (auditSupplier !== "all") q = q.eq("supplier", auditSupplier);
      if (auditStatus !== "all") q = q.eq("status", auditStatus);
      const { data, error } = await q;
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

  // Scrape metadata for chart tooltips: latest successful scrape per (supplier, price_date)
  // → email sent date + AI's date-phrase reason.
  const scrapeMetaQ = useQuery({
    queryKey: ["scrape-meta", days],
    queryFn: async () => {
      const since = format(subDays(new Date(), days), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("supplier_price_scrape_log" as any)
        .select("supplier, price_date, scraped_at, error")
        .eq("status", "success")
        .gte("price_date", since)
        .order("scraped_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as { supplier: string; price_date: string; scraped_at: string; error: string | null }[];
    },
  });
  // Map: `${supplier}|${price_date}` → latest successful entry (last write wins given asc order).
  const metaMap = useMemo(() => {
    const m = new Map<string, { sent: string; reason: string | null }>();
    (scrapeMetaQ.data || []).forEach(r => {
      if (!r.supplier || !r.price_date) return;
      m.set(`${r.supplier}|${r.price_date}`, { sent: r.scraped_at, reason: r.error });
    });
    return m;
  }, [scrapeMetaQ.data]);

  // Trend chart data (one row per date, columns per supplier)
  const allSuppliers = Array.from(new Set([...SUPPLIERS, ...prices.map(p => p.supplier)].filter(Boolean)));
  const trendData = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    [...prices].reverse().forEach(p => {
      const key = format(parseISO(p.price_date), "dd MMM");
      const row = map.get(key) || { date: key, _iso: p.price_date, _meta: {} as Record<string, { sent: string; reason: string | null }> };
      const v = showInc ? p.price_per_litre * GST : p.price_per_litre;
      row[p.supplier] = Number(v.toFixed(4));
      const meta = metaMap.get(`${p.supplier}|${p.price_date}`);
      if (meta) (row._meta as any)[p.supplier] = meta;
      map.set(key, row);
    });
    return Array.from(map.values()).map((row) => {
      const a = row["Pacific"];
      const b = row["Pro Fusion"];
      if (typeof a === "number" && typeof b === "number") {
        row["diff"] = Number(Math.abs(a - b).toFixed(4));
      }
      return row;
    });
  }, [prices, showInc, metaMap]);

  // Spread vs TGP chart
  const tgpSpread = useMemo(() => {
    const tgpMap = new Map(tgp.map(t => [t.price_date, t.price_per_litre / GST]));
    const dates = Array.from(new Set([...prices.map(p => p.price_date), ...tgp.map(t => t.price_date)])).sort();
    return dates.map(d => {
      const row: Record<string, any> = { date: format(parseISO(d), "dd MMM"), _iso: d, _meta: {} as Record<string, { sent: string; reason: string | null }>, tgp: tgpMap.get(d) ?? null };
      allSuppliers.forEach(s => {
        const p = prices.find(x => x.price_date === d && x.supplier === s);
        if (p && tgpMap.has(d)) row[`${s}_spread`] = Number((p.price_per_litre - (tgpMap.get(d) as number)).toFixed(4));
        const meta = metaMap.get(`${s}|${d}`);
        if (meta) (row._meta as any)[s] = meta;
      });
      return row;
    });
  }, [prices, tgp, allSuppliers, metaMap]);

  // Volume & spend per supplier — derived from driver intake logs, attributed
  // to the cheapest scraped supplier price on each intake date.
  const volSpend = useMemo(() => {
    // Build cheapest-supplier-by-date lookup from scraped buy_prices
    const cheapest = new Map<string, { supplier: string; price: number }>();
    prices.forEach((p) => {
      const cur = cheapest.get(p.price_date);
      if (!cur || p.price_per_litre < cur.price) {
        cheapest.set(p.price_date, { supplier: p.supplier, price: p.price_per_litre });
      }
    });
    const map = new Map<string, { litres: number; spend: number }>();
    let untaggedLitres = 0;
    let untaggedSpend = 0;
    (intakeQ.data || []).forEach((log: any) => {
      const litres = Number(log.litres_entered) || 0;
      // Spend is litres × retail price the bowser pump charged us (ex GST).
      const retail = Number(log.bowser_retail_price) || 0;
      const spend = litres * (retail / GST); // bowser retail is inc-GST → ex
      const match = cheapest.get(log.log_date);
      if (match) {
        const cur = map.get(match.supplier) || { litres: 0, spend: 0 };
        cur.litres += litres;
        cur.spend += spend;
        map.set(match.supplier, cur);
      } else {
        untaggedLitres += litres;
        untaggedSpend += spend;
      }
    });
    const rows = Array.from(map.entries()).map(([supplier, v]) => ({
      supplier,
      litres: Math.round(v.litres),
      spend: Math.round(v.spend),
      avg: v.litres > 0 ? v.spend / v.litres : 0,
    }));
    if (untaggedLitres > 0) {
      rows.push({
        supplier: "Unattributed",
        litres: Math.round(untaggedLitres),
        spend: Math.round(untaggedSpend),
        avg: untaggedLitres > 0 ? untaggedSpend / untaggedLitres : 0,
      });
    }
    return rows;
  }, [intakeQ.data, prices]);

  const totalIntakeLitres = useMemo(
    () => (intakeQ.data || []).reduce((s: number, l: any) => s + (Number(l.litres_entered) || 0), 0),
    [intakeQ.data],
  );

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
                <Tooltip cursor={{ fill: "var(--surface-border)", opacity: 0.25 }} content={<PriceTooltip suffix="/L" />} />
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
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Spread vs Viva Melbourne TGP (Ex GST) — negative = below TGP</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tgpSpread} barCategoryGap="20%" barGap={2}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v >= 0 ? "+" : ""}$${v.toFixed(3)}`} />
                <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="3 3" />
                <Tooltip cursor={{ fill: "var(--surface-border)", opacity: 0.25 }} content={<PriceTooltip suffix="/L" stripSuffix="_spread" signed />} />
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
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Gauge className="w-3 h-3" /> Volume & Spend (from reconciliation intake) — Last {days} days</div>
        </div>
        {volSpend.length === 0 ? (
          <div className="text-sm text-muted-foreground">No bowser intake recorded yet. Drivers log fuel intake from the Driver Portal — those entries feed this view automatically.</div>
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

      {/* Scrape audit table */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Scrape Audit — Email → Extracted Price → Effective Date
          </div>
          <div className="text-[10px] text-muted-foreground">{(scrapeLogQ.data || []).length} entries</div>
        </div>

        <div className="flex items-end gap-2 flex-wrap mb-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">From</label>
            <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} className="bg-raised border border-surface-border rounded-lg text-foreground px-2 py-1.5 text-[12px] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">To</label>
            <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} className="bg-raised border border-surface-border rounded-lg text-foreground px-2 py-1.5 text-[12px] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Supplier</label>
            <select value={auditSupplier} onChange={(e) => setAuditSupplier(e.target.value)} className="bg-raised border border-surface-border rounded-lg text-foreground px-2 py-1.5 text-[12px] outline-none">
              <option value="all">All</option>
              {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</label>
            <select value={auditStatus} onChange={(e) => setAuditStatus(e.target.value)} className="bg-raised border border-surface-border rounded-lg text-foreground px-2 py-1.5 text-[12px] outline-none">
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="parse_failed">Parse failed</option>
              <option value="skipped_stale">Skipped (stale)</option>
              <option value="skipped_duplicate">Skipped (duplicate)</option>
              <option value="no_email">No email</option>
              <option value="error">Error</option>
            </select>
          </div>
          <button
            onClick={() => { setAuditFrom(format(subDays(new Date(), 30), "yyyy-MM-dd")); setAuditTo(format(new Date(), "yyyy-MM-dd")); setAuditSupplier("all"); setAuditStatus("all"); }}
            className="bg-raised border border-surface-border rounded-lg text-foreground px-3 py-1.5 text-[11px] hover:bg-surface-border/40"
          >Reset</button>
        </div>

        {(scrapeLogQ.data || []).length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No scrape attempts in this range.</div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-[12px] min-w-[720px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-surface-border">
                  <th className="text-left py-2 px-2 font-medium">Scraped</th>
                  <th className="text-left py-2 px-2 font-medium">Supplier</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-right py-2 px-2 font-medium">Extracted Price</th>
                  <th className="text-left py-2 px-2 font-medium">Effective Date</th>
                  <th className="text-left py-2 px-2 font-medium">Date Phrase / Notes</th>
                </tr>
              </thead>
              <tbody>
                {(scrapeLogQ.data || []).map((l) => (
                  <tr key={l.id} className="border-b border-surface-border/60 hover:bg-raised/40">
                    <td className="py-2 px-2 text-muted-foreground tabular-nums whitespace-nowrap">{format(parseISO(l.scraped_at), "dd MMM HH:mm")}</td>
                    <td className="py-2 px-2 text-foreground">{l.supplier || "—"}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${l.status === "success" ? "text-positive bg-positive/10" : l.status?.startsWith("skipped") ? "text-muted-foreground bg-surface-border/40" : "text-destructive bg-destructive/10"}`}>{l.status}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-foreground">{l.price_per_litre != null ? `$${Number(l.price_per_litre).toFixed(4)}` : "—"}</td>
                    <td className="py-2 px-2 tabular-nums text-foreground">{l.price_date ? format(parseISO(l.price_date), "dd MMM yyyy") : "—"}</td>
                    <td className="py-2 px-2 text-muted-foreground max-w-[320px] truncate" title={l.error || ""}>{l.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}