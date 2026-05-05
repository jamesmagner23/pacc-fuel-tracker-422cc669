import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTGPrices } from "@/hooks/useTGPrices";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/hooks/useDateRange";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell
} from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TODAY = new Date();
const JULY1 = new Date("2026-07-01");
const daysToJuly = Math.ceil((JULY1.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));

const SEED_DATA = {
  brent: 108.4,
  brentChange: +3.2,
  audUsd: 0.618,
  audUsdChange: -0.004,
  melbTGP: 251.3,
  melbTGPChange: -6.1,
  dieselReservesDays: 29,
  petrolReservesDays: 36,
  exciseCutCPL: 32.0,
  ftcRate: 26.3,
  hormuzStatus: "RESTRICTED",
  shipmentStatus: "DIVERTED",
  singaporeAgreement: true,
  panicBuyingLevel: "MODERATE",
  supplyRisk: "HIGH",
};

const MONTHS = [
  {
    label: "APR 2026", status: "NOW", color: "var(--warning)", signal: "CAUTION",
    headline: "Excise cut active. TGP down ~32¢ but import cost still elevated. New truck timing ideal — demand surging.",
    actions: ["Update FTC claim to 26.3¢/L", "Lock in customers at current margin", "Monitor AIP TGP daily"],
  },
  {
    label: "MAY 2026", status: "DANGER", color: "var(--negative)", signal: "HIGH RISK",
    headline: "Lowest inbound gasoil month. Gulf of Mexico ships arrive but at premium cost. Localised shortages likely.",
    actions: ["Expect supply allocation pressure", "Prioritise contracted customers", "Watch May budget for excise extension"],
  },
  {
    label: "JUN 2026", status: "WATCH", color: "var(--warning)", signal: "WATCH",
    headline: "Supply stabilising if Hormuz reopens. May federal budget likely decides excise extension.",
    actions: ["Model July 1 reversion into all contracts", "Secure supply agreements pre-July", "Review fuel surcharge clauses"],
  },
  {
    label: "JUL 2026", status: "CLIFF", color: "var(--negative)", signal: "CLIFF",
    headline: `Excise reverts to 52.6¢/L. RUC reinstates. TGP could spike 26–32¢ overnight. ${daysToJuly} days away.`,
    actions: ["Ensure all contracts have price escalation clauses", "Rebuild FTC to 20.2¢/L", "Brief customers on price movement"],
  },
];

const SUPPLY_CHAIN = [
  { leg: "Middle East Crude", origin: "Persian Gulf", dest: "Asian Refineries", status: "BLOCKED", risk: 95 },
  { leg: "Singapore Refinery", origin: "Singapore", dest: "Melbourne", status: "SECURED", risk: 30 },
  { leg: "South Korea Supply", origin: "Ulsan", dest: "Melbourne", status: "REDUCED", risk: 60 },
  { leg: "Gulf of Mexico", origin: "Texas/Mexico", dest: "Melbourne", status: "ACTIVE", risk: 20 },
  { leg: "India Refinery", origin: "Mumbai", dest: "Melbourne", status: "REDUCED", risk: 55 },
  { leg: "Geelong Refinery", origin: "Local", dest: "VIC Distribution", status: "OPERATING", risk: 15 },
];

// Mock chart data
const BRENT_90_DAY = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - (89 - i));
  const conflictDay = Math.ceil((new Date("2026-02-28").getTime() - d.getTime()) / 86400000);
  const base = conflictDay > 0 ? 78 + Math.random() * 8 : 85 + (89 - conflictDay) * 0.25 + Math.random() * 6;
  return {
    date: d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }),
    rawDate: d.toISOString().split("T")[0],
    price: Math.round(Math.min(base + (i > 60 ? (i - 60) * 0.7 : 0), 115) * 10) / 10,
  };
});

const BUY_PRICE_TREND = Array.from({ length: 60 }, (_, i) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - (59 - i));
  return {
    date: d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }),
    price: 1.42 + Math.sin(i / 8) * 0.06 + i * 0.003 + Math.random() * 0.02,
    isForecast: false,
  };
});
// Add forecast to July 1
const lastPrice = BUY_PRICE_TREND[BUY_PRICE_TREND.length - 1].price;
for (let i = 1; i <= daysToJuly && i <= 90; i++) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + i);
  BUY_PRICE_TREND.push({
    date: d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }),
    price: lastPrice + i * 0.004 + Math.random() * 0.01,
    isForecast: true,
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    BLOCKED: "var(--negative)", RESTRICTED: "var(--negative)", HIGH: "var(--negative)",
    REDUCED: "var(--warning)", DIVERTED: "var(--warning)", MODERATE: "var(--warning)", WATCH: "var(--warning)",
    SECURED: "var(--positive)", OPERATING: "var(--positive)", ACTIVE: "var(--positive)",
  };
  return map[status] || "var(--text-muted)";
}

// ─── AI BRIEFING ──────────────────────────────────────────────────────────────
const BRIEFING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-briefing`;

function AIBriefing({ data, trigger }: { data: typeof SEED_DATA; trigger: number }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [ts, setTs] = useState<Date | null>(null);
  const [cachedLoaded, setCachedLoaded] = useState(false);

  useEffect(() => {
    async function loadCached() {
      const today = new Date().toISOString().split("T")[0];
      const { data: briefing } = await supabase
        .from("market_briefings")
        .select("content, created_at")
        .eq("briefing_date", today)
        .maybeSingle();
      if (briefing?.content) {
        setText(briefing.content);
        setTs(new Date(briefing.created_at));
        setCachedLoaded(true);
      }
    }
    loadCached();
  }, []);

  const generate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setText("");
    setTs(null);

    try {
      const resp = await fetch(BRIEFING_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ marketData: data }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.text();
        setText(`⚠ Error ${resp.status}: ${errBody}`);
        setTs(new Date());
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) { fullText += content; setText(fullText); }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) { fullText += content; setText(fullText); }
          } catch { /* ignore */ }
        }
      }

      setTs(new Date());
    } catch {
      setText("⚠ Network error. Check connection and retry.");
      setTs(new Date());
    }
    setLoading(false);
  }, [data, loading]);

  useEffect(() => { if (!cachedLoaded || trigger > 0) generate(); }, [trigger]);

  const sections = text.split(/\*\*(.*?)\*\*/g);

  return (
    <div className="bg-surface border border-surface-border rounded-[10px] overflow-hidden">
      <div className="p-4 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[10px] font-bold text-destructive uppercase tracking-[3px]">
              CLASSIFIED · DAILY INTELLIGENCE BRIEFING
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              PACC FUEL MARKET ASSESSMENT
            </div>
            <div className="text-[10px] text-muted-foreground/50 mt-1">
              {ts ? `GENERATED: ${ts.toLocaleTimeString("en-AU")} AEST · ${fmtDate(TODAY)}` : "GENERATING…"}
            </div>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="bg-primary text-primary-foreground border-none rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer disabled:opacity-50"
          >
            {loading ? "⟳ UPDATING…" : "↻ REFRESH"}
          </button>
        </div>
      </div>

      <div className="p-4" style={{ minHeight: 200 }}>
        {loading && !text && (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{
                height: 12, width: `${85 - i * 10}%`,
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
            <div className="text-[10px] uppercase tracking-[2px] text-muted-foreground/50 mt-2">
              FETCHING INTELLIGENCE...
            </div>
          </div>
        )}

        {text && (
          <div className="text-[12px] leading-relaxed text-muted-foreground">
            {sections.map((seg, i) => {
              if (i % 2 === 1) {
                return (
                  <div key={i} className="text-[11px] font-bold uppercase tracking-wider mt-4 mb-1.5 pb-1 border-b border-surface-border" style={{ color: "var(--accent-text)" }}>
                    ▸ {seg}
                  </div>
                );
              }
              const lines = seg.split("\n").filter(Boolean);
              return (
                <div key={i}>
                  {lines.map((line, j) => {
                    const isBullet = line.trim().startsWith("-") || line.trim().startsWith("•");
                    return (
                      <p key={j} className={isBullet ? "pl-3 text-destructive" : "text-muted-foreground"} style={{ margin: "4px 0" }}>
                        {line}
                      </p>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOOLTIP STYLE (shared) ───────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  background: "var(--background)",
  border: "1px solid var(--surface-border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--text-primary)",
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function MarketIntelligence() {
  const { data: tgpHistory } = useTGPrices("Melbourne", "Diesel", 7);

  const [marketMetrics, setMarketMetrics] = useState<Record<string, { value: number; previous_value: number | null }>>({});
  useEffect(() => {
    async function loadMetrics() {
      const today = new Date().toISOString().split("T")[0];
      const { data: rows } = await supabase
        .from("market_metrics")
        .select("metric_name, value, previous_value")
        .eq("metric_date", today);
      if (rows) {
        const map: Record<string, { value: number; previous_value: number | null }> = {};
        for (const r of rows) {
          map[r.metric_name] = { value: Number(r.value), previous_value: r.previous_value ? Number(r.previous_value) : null };
        }
        setMarketMetrics(map);
      }
    }
    loadMetrics();
  }, []);

  const data = useMemo(() => {
    const base = { ...SEED_DATA };
    if (tgpHistory && tgpHistory.length > 0) {
      const latest = tgpHistory[0];
      base.melbTGP = latest.price_cpl;
      if (tgpHistory.length > 1) {
        base.melbTGPChange = +(latest.price_cpl - tgpHistory[1].price_cpl).toFixed(1);
      } else {
        base.melbTGPChange = 0;
      }
    }
    if (marketMetrics.aud_usd) {
      base.audUsd = marketMetrics.aud_usd.value;
      base.audUsdChange = marketMetrics.aud_usd.previous_value
        ? +(marketMetrics.aud_usd.value - marketMetrics.aud_usd.previous_value).toFixed(4)
        : 0;
    }
    if (marketMetrics.brent_crude) {
      base.brent = marketMetrics.brent_crude.value;
      base.brentChange = marketMetrics.brent_crude.previous_value
        ? +(marketMetrics.brent_crude.value - marketMetrics.brent_crude.previous_value).toFixed(1)
        : 0;
    }
    return base;
  }, [tgpHistory, marketMetrics]);

  const [briefingTrigger, setBriefingTrigger] = useState(0);
  const [activeMonth, setActiveMonth] = useState(0);
  const [tab, setTab] = useState("OVERVIEW");

  const tabs = ["OVERVIEW", "SUPPLY CHAIN", "MONTH BY MONTH", "PACC IMPACT"];

  // ─── KPI data ───
  const kpis = [
    { label: "Brent Crude", value: `$${data.brent}`, sub: "USD/BBL", change: data.brentChange, isGood: false },
    { label: "AUD/USD", value: data.audUsd.toFixed(3), sub: "", change: data.audUsdChange * 100, isGood: true },
    { label: "Mel Diesel TGP", value: `${data.melbTGP}¢`, sub: "/L", change: data.melbTGPChange, isGood: false, highlight: true },
    { label: "Diesel Reserves", value: `${data.dieselReservesDays}`, sub: "DAYS", change: null, isGood: true },
    { label: "Excise Cut Active", value: `${data.exciseCutCPL}`, sub: "¢/L", change: null },
    { label: "FTC Rate", value: `${data.ftcRate}`, sub: "¢/L", change: null, highlight: true },
    { label: "Supply Risk", value: data.supplyRisk, sub: "", change: null },
    { label: "Days to July 1", value: `${daysToJuly}`, sub: "DAYS", change: null },
  ];

  return (
    <div className="flex flex-col gap-3 max-w-[1100px]">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Fuel Market Intelligence</h1>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Melbourne · Australia · {fmtDate(TODAY).toUpperCase()}
          </div>
        </div>
      </div>

      {/* LIVE TICKER */}
      <div className="bg-surface border border-surface-border rounded-[10px] px-4 py-2.5 flex flex-wrap gap-4 items-center">
        {[
          { k: "BRENT", v: `$${data.brent}`, u: "USD/BBL", d: data.brentChange },
          { k: "AUD/USD", v: data.audUsd.toFixed(3), u: "", d: data.audUsdChange * 1000 },
          { k: "MEL TGP", v: `${data.melbTGP}¢`, u: "/L", d: data.melbTGPChange },
        ].map(item => (
          <div key={item.k} className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.k}</span>
            <span className="text-[13px] font-semibold text-foreground tabular-nums">
              {item.v}<span className="text-[10px] text-muted-foreground">{item.u}</span>
            </span>
            <span className={`text-[10px] ${item.d > 0 ? "text-destructive" : "text-positive"}`}>
              {item.d > 0 ? "▲" : "▼"}{Math.abs(item.d).toFixed(1)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">HORMUZ</span>
          <span className="inline-block w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-[10px] font-bold text-destructive">RESTRICTED</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-muted-foreground">EXCISE CLIFF</span>
          <span className="text-lg font-bold text-destructive tabular-nums">{daysToJuly}d</span>
          <span className="text-[10px] text-muted-foreground">TO JUL 1</span>
        </div>
      </div>

      {/* TABS — matches Finance page style */}
      <div className="flex gap-0 border-b border-surface-border overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 sm:px-4 py-2 text-[12px] sm:text-[13px] rounded-none border-b-2 bg-transparent cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              tab === t
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "OVERVIEW" && (
        <div className="flex flex-col gap-3">
          {/* KPI Grid — matches PLOverview 2-col */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map((k) => {
              const up = k.change !== null && k.change !== undefined && k.change > 0;
              const changeColor = k.change === null || k.change === undefined
                ? undefined
                : (up === k.isGood ? "var(--positive)" : "var(--negative)");
              return (
                <div
                  key={k.label}
                  className={`bg-surface border rounded-[10px] p-4 ${k.highlight ? "border-primary/40" : "border-surface-border"}`}
                >
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {k.label}
                  </div>
                  <div className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight tabular-nums">
                    {k.value}
                    {k.sub && <span className="text-[11px] text-muted-foreground ml-0.5">{k.sub}</span>}
                  </div>
                  {k.change !== null && k.change !== undefined && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-[11px] font-medium" style={{ color: changeColor }}>
                        {up ? "▲" : "▼"} {Math.abs(k.change).toFixed(1)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">vs prev session</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Alert banners — matches PLOverview amber warning */}
          {[
            { color: "var(--negative)", icon: "⚠", text: "HORMUZ RESTRICTED — Gasoil inflows to Australia tracking -1.47M bbl vs January. April/May critical months." },
            { color: "var(--warning)", icon: "⏱", text: `EXCISE CLIFF IN ${daysToJuly} DAYS — Diesel TGP to spike +26–32¢/L on July 1 if not extended. All contracts must include escalation clauses.` },
            { color: "var(--positive)", icon: "✓", text: "NEW TRUCK TIMING OPTIMAL — Mobile delivery demand at historic high as retail stations report shortages. Market conditions favour your expansion." },
          ].map((a, i) => (
            <div key={i} className="bg-surface border rounded-[10px] p-4 flex items-start gap-3" style={{ borderColor: `${a.color}33` }}>
              <div className="text-lg mt-0.5" style={{ color: a.color }}>{a.icon}</div>
              <div className="text-[12px] font-medium text-foreground">{a.text}</div>
            </div>
          ))}

          {/* CHART: Fuel Buy Price Trend with forecast */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-4">
              Supply Price Trend — Forecast to July 1
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={BUY_PRICE_TREND}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval={Math.floor(BUY_PRICE_TREND.length / 8)} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toFixed(4)}/L`, "Buy Price"]} />
                  <ReferenceLine x={BUY_PRICE_TREND.find(d => d.isForecast)?.date} stroke="var(--negative)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "EXCISE REVERTS", position: "top", fontSize: 9, fill: "var(--negative)" }} />
                  {/* Actual line */}
                  <Line
                    type="monotone"
                    dataKey={(d: any) => d.isForecast ? null : d.price}
                    stroke="var(--positive)"
                    strokeWidth={2}
                    dot={false}
                    name="Actual"
                    connectNulls={false}
                  />
                  {/* Forecast line */}
                  <Line
                    type="monotone"
                    dataKey={(d: any) => d.isForecast ? d.price : null}
                    stroke="var(--accent)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    name="Forecast"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded inline-block bg-positive" /> Actual</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded inline-block bg-primary" style={{ borderTop: "2px dashed var(--accent)" }} /> Forecast</span>
            </div>
          </div>

          {/* CHART: Brent Crude 90-day */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-4">
              Brent Crude — 90 Day
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={BRENT_90_DAY}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval={Math.floor(BRENT_90_DAY.length / 6)} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toFixed(1)} USD/BBL`, "Brent"]} />
                  <ReferenceLine x={BRENT_90_DAY.find(d => d.rawDate >= "2026-02-28")?.date} stroke="var(--negative)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "CONFLICT START", position: "top", fontSize: 9, fill: "var(--negative)" }} />
                  <Line type="monotone" dataKey="price" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART: Reserve Days — horizontal bar */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-4">
              National Fuel Reserves
            </div>
            {[
              { label: "Diesel", days: data.dieselReservesDays },
              { label: "Petrol", days: data.petrolReservesDays },
            ].map(r => {
              const color = r.days < 20 ? "var(--negative)" : r.days < 30 ? "var(--warning)" : "var(--positive)";
              return (
                <div key={r.label} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">{r.label}</span>
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{r.days} days</span>
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((r.days / 60) * 100, 100)}%`, background: color }} />
                  </div>
                  <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground/50">
                    <span>0</span><span className="text-destructive">20 — Critical</span><span className="text-warning">30</span><span>60+</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CHART: Supply Route Risk — horizontal bars */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-4">
              Supply Route Disruption Risk
            </div>
            {SUPPLY_CHAIN.map(r => {
              const color = r.risk > 70 ? "var(--negative)" : r.risk > 40 ? "var(--warning)" : "var(--positive)";
              return (
                <div key={r.leg} className="mb-2.5">
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-foreground">{r.leg}</span>
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{r.risk}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${r.risk}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>

          <AIBriefing data={data} trigger={briefingTrigger} />
        </div>
      )}

      {/* ── SUPPLY CHAIN TAB ── */}
      {tab === "SUPPLY CHAIN" && (
        <div className="flex flex-col gap-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>
            ▸ LIVE SUPPLY CHAIN STATUS — REFINED DIESEL TO MELBOURNE
          </div>

          {SUPPLY_CHAIN.map((item, i) => (
            <div key={i} className="bg-surface border border-surface-border rounded-[10px] p-3 px-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <div className="text-[13px] font-semibold text-foreground">{item.leg}</div>
                <div className="text-[10px] text-muted-foreground">{item.origin} → {item.dest}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: statusColor(item.status), boxShadow: `0 0 6px ${statusColor(item.status)}` }} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.status}</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">RISK</div>
                <div className="text-[13px] font-bold tabular-nums" style={{ color: statusColor(item.status) }}>{item.risk}%</div>
              </div>
              <div className="w-[60px] h-1.5 rounded-full overflow-hidden bg-muted">
                <div className="h-full rounded-full" style={{ width: `${item.risk}%`, background: statusColor(item.status) }} />
              </div>
            </div>
          ))}

          {/* Shipping timeline */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3" style={{ color: "var(--accent-text)" }}>
              ▸ SAILING TIME COMPARISON
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { from: "Singapore", days: "10–14 days", cost: "NORMAL", status: "SECURED", color: "var(--positive)" },
                { from: "South Korea", days: "12–16 days", cost: "+15%", status: "REDUCED", color: "var(--warning)" },
                { from: "India", days: "14–18 days", cost: "+20%", status: "REDUCED", color: "var(--warning)" },
                { from: "Gulf of Mexico", days: "30–42 days", cost: "+60-80%", status: "ACTIVE (PREMIUM)", color: "var(--negative)" },
              ].map((r, i) => (
                <div key={i} className="bg-surface-raised rounded-[10px] p-3" style={{ borderLeft: `3px solid ${r.color}` }}>
                  <div className="text-[12px] font-semibold text-foreground">{r.from}</div>
                  <div className="text-[10px] text-muted-foreground">{r.days}</div>
                  <div className="text-[10px] text-muted-foreground/60">Cost premium: {r.cost}</div>
                  <div className="text-[10px] font-bold mt-1" style={{ color: r.color }}>{r.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Refinery status */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3" style={{ color: "var(--accent-text)" }}>
              ▸ DOMESTIC REFINERY STATUS
            </div>
            {[
              { name: "Viva Energy — Geelong, VIC", cap: "120,000 bbl/day", status: "OPERATING", coverage: "~10% national demand", note: "Your local advantage. Closest terminal to PACC Dandenong operations." },
              { name: "Ampol Lytton — Brisbane, QLD", cap: "109,000 bbl/day", status: "OPERATING", coverage: "~10% national demand", note: "Full operation. Supplies QLD/NSW primarily." },
            ].map((r, i) => (
              <div key={i} className="bg-surface-raised rounded-[10px] p-3 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-semibold text-foreground">{r.name}</span>
                  <span className="text-[10px] font-bold text-positive">{r.status}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Capacity: {r.cap} · Coverage: {r.coverage}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{r.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTH BY MONTH TAB ── */}
      {tab === "MONTH BY MONTH" && (
        <div className="flex flex-col gap-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>
            ▸ 4-MONTH OUTLOOK — DIESEL MARKET CONDITIONS FOR PACC FUEL
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MONTHS.map((m, i) => (
              <div
                key={i}
                onClick={() => setActiveMonth(i)}
                className="cursor-pointer bg-surface border rounded-[10px] p-4 transition-all"
                style={{
                  borderColor: activeMonth === i ? m.color : "var(--surface-border)",
                  borderTop: `4px solid ${m.color}`,
                }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[13px] font-bold text-foreground">{m.label}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider" style={{
                    background: `${m.color}1A`, color: m.color,
                  }}>{m.signal}</span>
                </div>
                <div className="text-[10px] leading-relaxed text-muted-foreground">{m.headline}</div>
              </div>
            ))}
          </div>

          <div className="bg-surface-raised border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3" style={{ color: "var(--accent-text)" }}>
              {MONTHS[activeMonth].label} — ACTION ITEMS FOR PACC FUEL
            </div>
            {MONTHS[activeMonth].actions.map((a, i) => (
              <div key={i} className="flex gap-2 py-1.5 text-[12px] text-muted-foreground">
                <span style={{ color: "var(--accent-text)" }}>→</span>
                <span>{a}</span>
              </div>
            ))}
          </div>

          {/* Scenario table */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5 overflow-x-auto">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3" style={{ color: "var(--accent-text)" }}>
              ▸ SCENARIO PRICE TABLE — MELBOURNE DIESEL TGP (AUD ¢/L)
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr>
                  {["Scenario", "Brent (USD/bbl)", "AUD/USD", "Import Cost", "Pre-July TGP", "Post-July TGP"].map(h => (
                    <th key={h} className="text-left p-1.5 px-2 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-surface-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { scenario: "🟢 Best Case", brent: 75, aud: 0.65, import_cost: 72, pre: 162, post: 188 },
                  { scenario: "🟡 Base Case", brent: 95, aud: 0.62, import_cost: 96, pre: 186, post: 212 },
                  { scenario: "🔴 Stress Case", brent: 120, aud: 0.60, import_cost: 125, pre: 215, post: 241 },
                  { scenario: "⚫ Crisis Case", brent: 150, aud: 0.58, import_cost: 162, pre: 252, post: 278 },
                ].map((r, i) => (
                  <tr key={i} className="border-b border-surface-border/50">
                    <td className="p-1.5 px-2 font-semibold text-foreground">{r.scenario}</td>
                    <td className="p-1.5 px-2 text-muted-foreground">${r.brent}</td>
                    <td className="p-1.5 px-2 text-muted-foreground">{r.aud}</td>
                    <td className="p-1.5 px-2 text-muted-foreground">~{r.import_cost}¢</td>
                    <td className="p-1.5 px-2 text-muted-foreground">{r.pre}¢</td>
                    <td className="p-1.5 px-2 text-muted-foreground">{r.post}¢</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[10px] text-muted-foreground/50 mt-2">
              † Pre-July TGP assumes 32¢ excise relief active. Post-July assumes full excise 52.6¢ + GST restored.
            </div>
          </div>
        </div>
      )}

      {/* ── PACC IMPACT TAB ── */}
      {tab === "PACC IMPACT" && (
        <div className="flex flex-col gap-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>
            ▸ DIRECT BUSINESS IMPACT ANALYSIS — PACC FUEL MELBOURNE
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                title: "FUEL TAX CREDIT — UPDATE REQUIRED", color: "var(--positive)",
                items: [
                  { label: "FTC Rate (was)", value: "20.2¢/L", note: "on-road heavy vehicles" },
                  { label: "FTC Rate (NOW)", value: "26.3¢/L", note: "effective 1 Apr – 30 Jun 2026", highlight: true },
                  { label: "Extra claim per 1,000L", value: "+$61", note: "update your BAS immediately" },
                  { label: "RUC (was)", value: "32.4¢/L", note: "heavy vehicle road user charge" },
                  { label: "RUC (NOW)", value: "ZERO", note: "zeroed until June 30", highlight: true },
                ],
              },
              {
                title: "NEW TRUCK — MARKET TIMING", color: "var(--warning)",
                items: [
                  { label: "Retail station shortages (VIC)", value: "~10%", note: "of outlets reporting outages" },
                  { label: "Demand spike vs normal", value: "+40-50%", note: "March peak, stabilising now" },
                  { label: "Independent operators", value: "RATIONED", note: "non-contracted buyers cut first" },
                  { label: "PACC contracted supply", value: "SECURED", note: "your moat vs competitors", highlight: true },
                  { label: "Optimal launch window", value: "NOW → MAY", note: "before shortages ease and demand normalises" },
                ],
              },
            ].map((panel, i) => (
              <div key={i} className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: panel.color }}>▸ {panel.title}</div>
                {panel.items.map((item, j) => (
                  <div key={j} className="flex justify-between items-center py-2 border-b border-surface-border/50" style={{
                    background: item.highlight ? `${panel.color}0A` : undefined,
                  }}>
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    <div className="text-right">
                      <div className="text-[13px] font-bold tabular-nums" style={{ color: item.highlight ? panel.color : "var(--text-primary)" }}>{item.value}</div>
                      <div className="text-[10px] text-muted-foreground/50">{item.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3" style={{ color: "var(--accent-text)" }}>
              ▸ CONTRACT PROTECTION CHECKLIST — BEFORE JULY 1
            </div>
            {[
              { done: true, item: "Add AIP TGP-linked fuel escalation clause to all multi-month supply agreements" },
              { done: true, item: "Update FTC line in BAS from 20.2¢ to 26.3¢/L for Q2 2026" },
              { done: false, item: "Remove/zero heavy vehicle RUC in fuel surcharge matrix (temporary, revert Jul 1)" },
              { done: false, item: "Brief civil construction customers on July 1 reversion (+26¢/L TGP overnight)" },
              { done: false, item: "Model worst-case: Brent $120 + AUD 0.60 + full excise restored = ~241¢/L TGP" },
              { done: false, item: "Secure forward supply agreements with Viva Geelong or Ampol before June 30" },
              { done: false, item: "Build cash buffer for July 1 working capital spike (higher upfront TGP costs)" },
            ].map((c, i) => (
              <div key={i} className="flex gap-2.5 py-2 text-[12px] items-start border-b border-surface-border/50" style={{
                color: c.done ? "var(--positive)" : "var(--text-secondary)",
              }}>
                <span className="font-bold w-4 shrink-0">{c.done ? "✓" : "○"}</span>
                <span style={{ textDecoration: c.done ? "line-through" : undefined, opacity: c.done ? 0.6 : 1 }}>{c.item}</span>
              </div>
            ))}
          </div>

          {/* Social procurement */}
          <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2" style={{ color: "var(--accent-text)" }}>
              ▸ SOCIAL PROCUREMENT ANGLE — KELLER & CIVIL SECTOR
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Fuel shortages are hitting construction sites directly. Civil contractors (your Keller-type clients) are being charged 8–10% fuel surcharges by suppliers and are actively seeking guaranteed, on-site diesel delivery partners. Your mobile delivery model + social procurement certification = a compelling pitch during a shortage. Diesel-dependent plant — excavators, compactors, generators — cannot stop. You provide certainty when the servo down the road is dry.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-surface-border text-center">
        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
          Data: AIP TGP · EIA STEO · Argus Media · Vortexa · PM&C · DCCEEW · ACCC
        </div>
        <div className="text-[10px] text-muted-foreground/30 uppercase tracking-wider mt-1">
          PACC FUEL INTELLIGENCE SYSTEM · {TODAY.getFullYear()} · AI BRIEFINGS VIA LOVABLE AI
        </div>
      </div>
    </div>
  );
}
