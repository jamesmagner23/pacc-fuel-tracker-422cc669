import { useMemo, useState } from "react";
import { format, parseISO, subDays, differenceInCalendarDays, eachDayOfInterval } from "date-fns";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, LineChart, Line, CartesianGrid, Cell, LabelList,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBuyPrices, useTodayBuyPrices, SUPPLIERS } from "@/hooks/useBuyPrices";
import { useTGPrices } from "@/hooks/useTGPrices";
import { RefreshCw, Mail, Gauge, ArrowDown, ArrowUp, Clock } from "lucide-react";
import { toast } from "sonner";

/* ---------- palette (lifted from index.css tokens) ---------- */
const C_LIME = "#C8F26A";       // var(--accent), Pro Fusion + good
const C_SAGE = "#7BAE6F";       // Pacific — deeper sage step-down from lime
const C_CORAL = "#FF6B5E";      // var(--negative), above TGP / bad
const C_GRID = "#1F3A24";       // var(--surface-raised)-ish
const C_AXIS = "#8B8773";       // var(--text-muted)
const SUPPLIER_COLORS: Record<string, string> = { Pacific: C_SAGE, "Pro Fusion": C_LIME };
const colorFor = (s: string) => SUPPLIER_COLORS[s] || C_SAGE;
const GST = 1.1;
const EXCISE_CLIFF = new Date("2026-07-01");

/* ---------- helpers ---------- */
const fmtCpl = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}c`;
const fmtPrice = (v: number) => `$${v.toFixed(4)}`;
const rollingAvg = (vals: (number | null)[], window = 7) =>
  vals.map((_, i) => {
    const slice = vals.slice(Math.max(0, i - window + 1), i + 1).filter((x): x is number => x != null);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });

interface ScrapeLog {
  id: string; scraped_at: string; supplier: string | null;
  status: string; price_per_litre: number | null;
  price_date: string | null; error: string | null;
}

export default function Suppliers() {
  const qc = useQueryClient();
  const [showInc, setShowInc] = useState(false);
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [notionalLitres, setNotionalLitres] = useState(5000);
  const [running, setRunning] = useState(false);

  const { data: prices = [] } = useBuyPrices(Math.max(days, 30));
  const { data: todayPrices = [] } = useTodayBuyPrices();
  const { data: tgp = [] } = useTGPrices("Melbourne", "Diesel", Math.max(days, 30), "Viva");

  // Driver intake (volume & spend ledger)
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

  // Scrape audit
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

  /* ---------- DECISION HERO ---------- */
  const hero = useMemo(() => {
    if (!todayPrices.length) return null;
    const sorted = [...todayPrices].sort((a, b) => a.price_per_litre - b.price_per_litre);
    const winner = sorted[0];
    const other = sorted[1];
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const tgpToday = tgp.find(t => t.price_date === todayIso) ?? tgp[tgp.length - 1];
    const winnerEx = winner.price_per_litre;
    const otherEx = other?.price_per_litre;
    const tgpEx = tgpToday ? tgpToday.price_per_litre / GST : null;
    return {
      winner, other,
      winnerEx, otherEx, tgpEx,
      vsOther: otherEx != null ? winnerEx - otherEx : null,
      vsTgp: tgpEx != null ? winnerEx - tgpEx : null,
      asOf: winner.created_at ?? null,
    };
  }, [todayPrices, tgp]);

  const daysToExcise = differenceInCalendarDays(EXCISE_CLIFF, new Date());

  /* ---------- SPREAD VS TGP (horizontal grouped bar chart) ---------- */
  const spreadData = useMemo(() => {
    const today = new Date();
    const start = subDays(today, days - 1);
    const range = eachDayOfInterval({ start, end: today });
    const tgpMap = new Map(tgp.map(t => [t.price_date, t.price_per_litre / GST]));
    return range.map(d => {
      const iso = format(d, "yyyy-MM-dd");
      const t = tgpMap.get(iso);
      const row: any = { date: format(d, "EEE dd"), iso };
      SUPPLIERS.forEach(s => {
        const p = prices.find(x => x.price_date === iso && x.supplier === s);
        row[`${s}_spread`] = p && t != null ? Number((p.price_per_litre - t).toFixed(4)) : null;
        row[`${s}_price`] = p?.price_per_litre ?? null;
      });
      row.tgp = t ?? null;
      return row;
    }).reverse(); // most recent at top
  }, [prices, tgp, days]);

  /* ---------- DAILY BUY PRICE LINES ---------- */
  const lineData = useMemo(() => {
    const today = new Date();
    const start = subDays(today, days - 1);
    const range = eachDayOfInterval({ start, end: today });
    const rows = range.map(d => {
      const iso = format(d, "yyyy-MM-dd");
      const row: any = { date: format(d, "dd MMM"), iso };
      SUPPLIERS.forEach(s => {
        const p = prices.find(x => x.price_date === iso && x.supplier === s);
        row[s] = p ? (showInc ? p.price_per_litre * GST : p.price_per_litre) : null;
      });
      return row;
    });
    // Append rolling 7d averages
    SUPPLIERS.forEach(s => {
      const series = rows.map(r => r[s]);
      const avg = rollingAvg(series, 7);
      rows.forEach((r, i) => { r[`${s}_avg`] = avg[i]; });
    });
    return rows;
  }, [prices, days, showInc]);

  const latestSpread = useMemo(() => {
    // last day where both suppliers exist
    for (let i = lineData.length - 1; i >= 0; i--) {
      const r = lineData[i];
      const a = r["Pacific"], b = r["Pro Fusion"];
      if (typeof a === "number" && typeof b === "number") {
        return { iso: r.iso, date: r.date, diff: a - b, pacific: a, profusion: b };
      }
    }
    return null;
  }, [lineData]);

  /* ---------- CUMULATIVE POSITION ---------- */
  const cumulative = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 6);
    const range = eachDayOfInterval({ start, end: today });
    let cheapestSpend = 0, pacificSpend = 0, daysCounted = 0;
    range.forEach(d => {
      const iso = format(d, "yyyy-MM-dd");
      const dayPrices = prices.filter(p => p.price_date === iso);
      if (!dayPrices.length) return;
      const cheapest = dayPrices.reduce((m, p) => p.price_per_litre < m.price_per_litre ? p : m);
      const pacific = dayPrices.find(p => p.supplier === "Pacific") ?? cheapest;
      cheapestSpend += cheapest.price_per_litre * notionalLitres;
      pacificSpend += pacific.price_per_litre * notionalLitres;
      daysCounted++;
    });
    return { saved: pacificSpend - cheapestSpend, daysCounted };
  }, [prices, notionalLitres]);

  /* ---------- VOLUME & SPEND ---------- */
  const ledger = useMemo(() => {
    const cheapestByDate = new Map<string, { supplier: string; price: number }>();
    prices.forEach(p => {
      const cur = cheapestByDate.get(p.price_date);
      if (!cur || p.price_per_litre < cur.price) {
        cheapestByDate.set(p.price_date, { supplier: p.supplier, price: p.price_per_litre });
      }
    });
    const rows = (intakeQ.data || []).map((log: any) => {
      const litres = Number(log.litres_entered) || 0;
      const retail = Number(log.bowser_retail_price) || 0;
      const spendEx = litres * (retail / GST);
      const match = cheapestByDate.get(log.log_date);
      return {
        id: log.id,
        date: log.log_date,
        litres,
        spend: spendEx,
        supplier: match?.supplier ?? "Unattributed",
        rate: litres > 0 ? spendEx / litres : 0,
      };
    });
    const totals = rows.reduce(
      (acc, r) => {
        acc.litres += r.litres;
        acc.spend += r.spend;
        const k = r.supplier;
        acc.bySupplier[k] = acc.bySupplier[k] || { litres: 0, spend: 0 };
        acc.bySupplier[k].litres += r.litres;
        acc.bySupplier[k].spend += r.spend;
        return acc;
      },
      { litres: 0, spend: 0, bySupplier: {} as Record<string, { litres: number; spend: number }> }
    );
    return { rows, totals };
  }, [intakeQ.data, prices]);

  const handleRunScrape = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("scrape-supplier-prices");
      if (error) throw error;
      toast.success("Scraper run complete");
      qc.invalidateQueries({ queryKey: ["buy-prices"] });
      qc.invalidateQueries({ queryKey: ["buy-prices-today-all"] });
      qc.invalidateQueries({ queryKey: ["supplier-scrape-log"] });
    } catch {
      toast.error("Scrape failed — check the log");
    } finally { setRunning(false); }
  };

  /* ---------- chart tooltips ---------- */
  const SpreadTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
      <div className="bg-surface-raised border border-surface-border rounded-md p-2.5 text-[11px] tabular-nums min-w-[180px]">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{row.date}</div>
        {row.tgp != null && (
          <div className="flex justify-between text-muted-foreground mb-1">
            <span>Viva TGP</span><span className="text-foreground">{fmtPrice(row.tgp)}</span>
          </div>
        )}
        {SUPPLIERS.map(s => {
          const sp = row[`${s}_spread`], pr = row[`${s}_price`];
          if (sp == null) return null;
          const c = sp <= 0 ? C_LIME : C_CORAL;
          return (
            <div key={s} className="flex items-center justify-between gap-3 py-0.5">
              <span className="flex items-center gap-1.5 text-foreground">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: colorFor(s) }} />{s}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{fmtPrice(pr)}</span>
                <span style={{ color: c }} className="font-medium">{fmtCpl(sp)}/L</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const LineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-surface-raised border border-surface-border rounded-md p-2.5 text-[11px] tabular-nums min-w-[160px]">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
        {payload.filter((p: any) => !p.dataKey.endsWith("_avg") && p.value != null).map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
            <span className="flex items-center gap-1.5 text-foreground">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.stroke }} />{p.dataKey}
            </span>
            <span className="text-foreground">{fmtPrice(p.value)}/L</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 max-w-[1200px]">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-foreground tracking-tight">Suppliers</h1>
          <p className="text-[11px] text-muted-foreground mt-1 normal-case">Procurement intelligence — Pacific vs Pro Fusion vs Viva TGP</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface border border-surface-border rounded-full p-1">
            {([7, 14, 30] as const).map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 text-[11px] rounded-full tabular-nums ${days === d ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {d}d
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-surface border border-surface-border rounded-full p-1">
            <button onClick={() => setShowInc(false)} className={`px-3 py-1 text-[11px] rounded-full ${!showInc ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>Ex GST</button>
            <button onClick={() => setShowInc(true)} className={`px-3 py-1 text-[11px] rounded-full ${showInc ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>Inc GST</button>
          </div>
          <button onClick={handleRunScrape} disabled={running}
            className="border border-surface-border rounded-full px-3 py-1.5 text-[11px] text-foreground flex items-center gap-1.5 hover:bg-surface disabled:opacity-60">
            <RefreshCw className={`w-3 h-3 ${running ? "animate-spin" : ""}`} />
            {running ? "Scraping…" : "Scrape now"}
          </button>
        </div>
      </div>

      {/* 1. DECISION HERO */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-5 sm:p-7 relative overflow-hidden">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Today's Recommendation</div>
            {hero ? (
              <>
                <h2 className="text-foreground tracking-tight" style={{ fontSize: 30, lineHeight: 1.1 }}>
                  Buy from <span style={{ color: C_LIME }}>{hero.winner.supplier.toUpperCase()}</span> today
                </h2>
                <div className="text-[12px] text-muted-foreground mt-2 tabular-nums">
                  {hero.vsOther != null && (
                    <span>{fmtCpl(hero.vsOther)}/L vs {hero.other?.supplier}</span>
                  )}
                  {hero.vsOther != null && hero.vsTgp != null && <span className="mx-1.5 opacity-50">·</span>}
                  {hero.vsTgp != null && (
                    <span>{fmtCpl(hero.vsTgp)}/L vs Viva TGP</span>
                  )}
                </div>
                {hero.asOf && (
                  <div className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> as of {format(parseISO(hero.asOf), "HH:mm")}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-foreground tracking-tight" style={{ fontSize: 26, lineHeight: 1.15 }}>No quotes in yet today</h2>
                <p className="text-[12px] text-muted-foreground mt-2">Pricing typically lands by midday. Use <span className="text-foreground">Scrape now</span> to pull the latest emails.</p>
              </>
            )}
          </div>

          {/* Side-by-side prices */}
          {hero && (
            <div className="flex items-end gap-6">
              {[hero.winner, hero.other].filter(Boolean).map((p, i) => {
                const isWinner = i === 0;
                const v = showInc ? p.price_per_litre * GST : p.price_per_litre;
                return (
                  <div key={p.id} className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-end gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorFor(p.supplier) }} />
                      {p.supplier}
                    </div>
                    <div className="tabular-nums tracking-tight" style={{
                      fontSize: isWinner ? 36 : 26,
                      color: isWinner ? C_LIME : "var(--text-secondary)",
                      opacity: isWinner ? 1 : 0.6,
                      fontWeight: 600,
                    }}>
                      ${v.toFixed(4)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">/L {showInc ? "inc" : "ex"} GST</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Excise countdown */}
        <div className="absolute top-3 right-4 text-[10px] text-muted-foreground tabular-nums">
          {daysToExcise > 0 ? `Excise step-up in ${daysToExcise} days` : `Excise step-up effective ${format(EXCISE_CLIFF, "dd MMM yyyy")}`}
        </div>
      </div>

      {/* 2. SPREAD VS VIVA TGP */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Spread vs Viva TGP — last {days} days</div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: C_SAGE }} />Pacific</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: C_LIME }} />Pro Fusion</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: C_CORAL }} />Above TGP</span>
          </div>
        </div>
        <div style={{ height: Math.max(220, days * 28) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spreadData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barCategoryGap={6} barGap={2}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C_AXIS }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}c`}
                domain={['dataMin - 0.01', 'dataMax + 0.01']} />
              <YAxis dataKey="date" type="category" tick={{ fontSize: 10, fill: C_AXIS }} axisLine={false} tickLine={false} width={56} />
              <ReferenceLine x={0} stroke={C_LIME} strokeWidth={1.5} ifOverflow="extendDomain"
                label={{ value: "VIVA TGP", position: "top", fill: C_LIME, fontSize: 9, offset: 4 }} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<SpreadTooltip />} />
              {SUPPLIERS.map(s => (
                <Bar key={s} dataKey={`${s}_spread`} barSize={9} radius={[2, 2, 2, 2]}>
                  {spreadData.map((row, i) => {
                    const v = row[`${s}_spread`];
                    const c = v == null ? "transparent" : v > 0 ? C_CORAL : colorFor(s);
                    return <Cell key={i} fill={c} />;
                  })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. DAILY BUY PRICE LINES */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily Buy Price — last {days} days · {showInc ? "Inc" : "Ex"} GST</div>
          <div className="flex items-center gap-3 text-[10px]">
            {SUPPLIERS.map(s => (
              <span key={s} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block w-3 h-0.5" style={{ background: colorFor(s) }} />{s}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block w-3 h-0.5 border-t border-dashed" style={{ borderColor: C_AXIS }} />7d avg
            </span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 16, right: 64, left: 8, bottom: 4 }}>
              <CartesianGrid stroke={C_GRID} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: C_AXIS }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: C_AXIS }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${v.toFixed(2)}`} domain={['auto', 'auto']} />
              <Tooltip cursor={{ stroke: C_GRID }} content={<LineTooltip />} />
              {SUPPLIERS.map(s => (
                <Line key={s} type="monotone" dataKey={s} stroke={colorFor(s)}
                  strokeWidth={1.75} dot={{ r: 2.5, fill: colorFor(s), strokeWidth: 0 }}
                  activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
              ))}
              {SUPPLIERS.map(s => (
                <Line key={`${s}_avg`} type="monotone" dataKey={`${s}_avg`} stroke={colorFor(s)}
                  strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} dot={false} connectNulls isAnimationActive={false} />
              ))}
              {latestSpread && (
                <ReferenceLine x={latestSpread.date} stroke="transparent"
                  label={{ value: `${fmtCpl(latestSpread.diff)}`, position: "right",
                    fill: latestSpread.diff <= 0 ? C_LIME : C_CORAL, fontSize: 11, offset: 8 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. CUMULATIVE POSITION */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Cumulative position — last 7 days</div>
            <div className="text-foreground tabular-nums" style={{ fontSize: 22, lineHeight: 1.2 }}>
              {cumulative.saved >= 0 ? <ArrowDown className="inline w-4 h-4 mr-1" style={{ color: C_LIME }} /> : <ArrowUp className="inline w-4 h-4 mr-1" style={{ color: C_CORAL }} />}
              <span style={{ color: cumulative.saved >= 0 ? C_LIME : C_CORAL }}>${Math.abs(cumulative.saved).toFixed(0)}</span>
              <span className="text-muted-foreground text-[13px] font-normal ml-2">
                {cumulative.saved >= 0 ? "saved" : "lost"} buying cheapest each day vs Pacific-only
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">
              Notional {notionalLitres.toLocaleString()} L/day · {cumulative.daysCounted} days with quotes
            </div>
          </div>
          <div className="flex items-center gap-1 bg-surface-raised border border-surface-border rounded-full p-1">
            {[2000, 5000, 10000].map(v => (
              <button key={v} onClick={() => setNotionalLitres(v)}
                className={`px-2.5 py-1 text-[10px] rounded-full tabular-nums ${notionalLitres === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {(v / 1000)}k L/day
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. VOLUME & SPEND LEDGER */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3 h-3" /> Volume & Spend — last {days} days
          </div>
          {ledger.totals.litres > 0 && (
            <div className="text-[11px] text-muted-foreground tabular-nums">
              Total <span className="text-foreground">{ledger.totals.litres.toLocaleString()} L</span> ·
              <span className="text-foreground"> ${Math.round(ledger.totals.spend).toLocaleString()}</span> ex GST
            </div>
          )}
        </div>

        {ledger.rows.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[13px] text-foreground mb-1">No purchases logged yet</p>
            <p className="text-[11px] text-muted-foreground">Drivers log fuel intake from the Driver Portal — those entries flow in automatically and get attributed to the cheapest supplier on the day.</p>
          </div>
        ) : (
          <>
            {/* per-supplier split */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              {Object.entries(ledger.totals.bySupplier).map(([sup, t]) => (
                <div key={sup} className="border border-surface-border rounded-md p-3">
                  <div className="text-[11px] text-foreground flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorFor(sup) }} />{sup}
                  </div>
                  <div className="text-[18px] font-semibold text-foreground tabular-nums mt-1">{t.litres.toLocaleString()}<span className="text-[11px] text-muted-foreground font-normal"> L</span></div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">${Math.round(t.spend).toLocaleString()} · avg ${(t.spend / t.litres).toFixed(4)}/L</div>
                </div>
              ))}
            </div>
            {/* compact ledger */}
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-[12px] min-w-[520px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-surface-border">
                    <th className="text-left py-2 px-2 font-medium">Date</th>
                    <th className="text-left py-2 px-2 font-medium">Attributed</th>
                    <th className="text-right py-2 px-2 font-medium">Litres</th>
                    <th className="text-right py-2 px-2 font-medium">Rate /L</th>
                    <th className="text-right py-2 px-2 font-medium">Spend ex GST</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map(r => (
                    <tr key={r.id} className="border-b border-surface-border/60 hover:bg-surface-raised/30">
                      <td className="py-2 px-2 text-muted-foreground tabular-nums whitespace-nowrap">{format(parseISO(r.date), "dd MMM")}</td>
                      <td className="py-2 px-2 text-foreground"><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: colorFor(r.supplier) }} />{r.supplier}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-foreground">{r.litres.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">${r.rate.toFixed(4)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-foreground">${Math.round(r.spend).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* SCRAPE AUDIT (kept) */}
      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Scrape Audit
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">{(scrapeLogQ.data || []).length} entries</div>
        </div>
        <div className="flex items-end gap-2 flex-wrap mb-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">From</label>
            <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} className="bg-surface-raised border border-surface-border rounded-md text-foreground px-2 py-1.5 text-[12px] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">To</label>
            <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} className="bg-surface-raised border border-surface-border rounded-md text-foreground px-2 py-1.5 text-[12px] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Supplier</label>
            <select value={auditSupplier} onChange={(e) => setAuditSupplier(e.target.value)} className="bg-surface-raised border border-surface-border rounded-md text-foreground px-2 py-1.5 text-[12px] outline-none">
              <option value="all">All</option>
              {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</label>
            <select value={auditStatus} onChange={(e) => setAuditStatus(e.target.value)} className="bg-surface-raised border border-surface-border rounded-md text-foreground px-2 py-1.5 text-[12px] outline-none">
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
            className="bg-surface-raised border border-surface-border rounded-md text-foreground px-3 py-1.5 text-[11px] hover:bg-surface-border/40">
            Reset
          </button>
        </div>
        {(scrapeLogQ.data || []).length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">No scrape attempts in this range.</div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-[12px] min-w-[720px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-surface-border">
                  <th className="text-left py-2 px-2 font-medium">Scraped</th>
                  <th className="text-left py-2 px-2 font-medium">Supplier</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-right py-2 px-2 font-medium">Extracted</th>
                  <th className="text-left py-2 px-2 font-medium">Effective</th>
                  <th className="text-left py-2 px-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(scrapeLogQ.data || []).map((l) => (
                  <tr key={l.id} className="border-b border-surface-border/60 hover:bg-surface-raised/30">
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
