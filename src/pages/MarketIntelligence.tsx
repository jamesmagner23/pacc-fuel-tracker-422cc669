import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTGPrices } from "@/hooks/useTGPrices";
import { supabase } from "@/integrations/supabase/client";

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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    BLOCKED: "var(--negative)", RESTRICTED: "var(--negative)", HIGH: "var(--negative)",
    REDUCED: "var(--warning)", DIVERTED: "var(--warning)", MODERATE: "var(--warning)", WATCH: "var(--warning)",
    SECURED: "var(--positive)", OPERATING: "var(--positive)", ACTIVE: "var(--positive)", MODERATE_LOW: "var(--positive)",
  };
  const c = map[status] || "var(--text-muted)";
  return (
    <span className="inline-block w-2 h-2 rounded-full" style={{
      background: c, boxShadow: `0 0 6px ${c}`,
      animation: status === "BLOCKED" || status === "RESTRICTED" ? "pulse 1.5s infinite" : undefined,
    }} />
  );
}

function RiskBar({ value }: { value: number }) {
  const c = value > 70 ? "var(--negative)" : value > 40 ? "var(--warning)" : "var(--positive)";
  return (
    <div className="w-[60px] h-1 rounded-sm overflow-hidden" style={{ background: "var(--surface-border)" }}>
      <div className="h-full rounded-sm transition-all duration-500" style={{ width: `${value}%`, background: c }} />
    </div>
  );
}

function Metric({ label, value, unit, change, changeUnit, highlight }: {
  label: string; value: string | number; unit: string;
  change?: number; changeUnit?: string; highlight?: boolean;
}) {
  const up = change !== undefined && change > 0;
  const neutral = change === 0 || change === undefined;
  const isGood = label.includes("RESERVE") || label.includes("FTC");
  const changeColor = neutral ? "var(--text-muted)" : (up === isGood ? "var(--positive)" : "var(--negative)");

  return (
    <div className="rounded-md flex flex-col gap-1" style={{
      background: highlight ? "var(--surface-raised)" : "var(--surface)",
      border: `1px solid ${highlight ? "var(--accent)" : "var(--surface-border)"}`,
      padding: "12px 14px",
    }}>
      <span className="text-2xs tracking-widest font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        {value}<span className="text-xs ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>
      </span>
      {change !== undefined && (
        <span className="text-2xs" style={{ color: changeColor }}>
          {up ? "▲" : "▼"} {Math.abs(change).toFixed(change % 1 === 0 ? 0 : 1)}{changeUnit} vs prev session
        </span>
      )}
    </div>
  );
}

// ─── AI BRIEFING ENGINE ───────────────────────────────────────────────────────
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
            if (content) {
              fullText += content;
              setText(fullText);
            }
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
    <div className="glass-card overflow-hidden">
      <div className="p-3.5 px-4" style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--surface-border)" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-2xs font-bold tracking-[3px]" style={{ color: "var(--negative)" }}>
              CLASSIFIED · DAILY INTELLIGENCE BRIEFING
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              PACC FUEL MARKET ASSESSMENT
            </div>
            <div className="text-2xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
              {ts ? `GENERATED: ${ts.toLocaleTimeString("en-AU")} AEST · ${fmtDate(TODAY)}` : "GENERATING…"}
            </div>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-ghost text-2xs tracking-wider"
            style={{ cursor: loading ? "wait" : "pointer" }}
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
            <div className="text-2xs tracking-[2px] mt-2" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
              FETCHING INTELLIGENCE...
            </div>
          </div>
        )}

        {text && (
          <div className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {sections.map((seg, i) => {
              if (i % 2 === 1) {
                return (
                  <div key={i} className="text-xs font-bold tracking-wider mt-4 mb-1.5 pb-1" style={{
                    color: "var(--accent-text)", borderBottom: "1px solid var(--surface-border)",
                  }}>
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
                      <p key={j} style={{
                        margin: "4px 0", paddingLeft: isBullet ? 12 : 0,
                        color: isBullet ? "var(--negative)" : "var(--text-secondary)",
                      }}>
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

  return (
    <div className="max-w-[1200px] mx-auto">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>

      {/* HEADER */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⛽</span>
          <div>
            <h1 className="text-lg font-bold tracking-[3px]">FUEL MARKET INTELLIGENCE</h1>
            <div className="text-2xs tracking-[2px]" style={{ color: "var(--text-muted)" }}>
              MELBOURNE · AUSTRALIA · DAILY BRIEFING SYSTEM
            </div>
          </div>
        </div>

        {/* LIVE TICKER */}
        <div className="flex flex-wrap gap-2 p-2 px-3 glass-card items-center">
          {[
            { k: "BRENT", v: `$${data.brent}`, u: "USD/BBL", d: data.brentChange },
            { k: "AUD/USD", v: data.audUsd.toFixed(3), u: "", d: data.audUsdChange * 1000 },
            { k: "MEL TGP", v: `${data.melbTGP}¢`, u: "/L", d: data.melbTGPChange },
          ].map(item => (
            <div key={item.k} className="flex items-center gap-1.5 mr-3">
              <span className="text-2xs tracking-wider" style={{ color: "var(--text-muted)" }}>{item.k}</span>
              <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {item.v}<span className="text-2xs" style={{ color: "var(--text-muted)" }}>{item.u}</span>
              </span>
              <span className="text-2xs" style={{ color: item.d > 0 ? "var(--negative)" : "var(--positive)" }}>
                {item.d > 0 ? "▲" : "▼"}{Math.abs(item.d).toFixed(1)}
              </span>
            </div>
          ))}

          <div className="flex items-center gap-1 mr-3">
            <span className="text-2xs tracking-wider" style={{ color: "var(--text-muted)" }}>HORMUZ</span>
            <StatusDot status="RESTRICTED" />
            <span className="text-2xs font-bold" style={{ color: "var(--negative)" }}>RESTRICTED</span>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-2xs" style={{ color: "var(--text-muted)" }}>EXCISE CLIFF</span>
            <span className="text-lg font-bold" style={{ color: "var(--negative)" }}>{daysToJuly}d</span>
            <span className="text-2xs" style={{ color: "var(--text-muted)" }}>TO JUL 1</span>
          </div>
        </div>
      </div>

      {/* DATE BAR */}
      <div className="flex flex-wrap justify-between items-center p-1.5 px-3 rounded mb-2 gap-2" style={{ background: "var(--surface-raised)" }}>
        <span className="text-2xs tracking-wider" style={{ color: "var(--text-muted)" }}>📅 {fmtDate(TODAY).toUpperCase()}</span>
        <div className="flex flex-wrap gap-3">
          {[
            `Hormuz Crisis Active — Day ${Math.ceil((TODAY.getTime() - new Date("2026-02-28").getTime()) / 86400000)}`,
            "Excise Cut Active: 32¢/L relief",
            "Singapore Supply Agreement: SECURED",
          ].map((t, i) => (
            <span key={i} className="text-2xs tracking-wider" style={{ color: "var(--text-muted)", opacity: 0.5 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-0 border-b border-surface-border mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2.5 text-2xs tracking-[2px] cursor-pointer border-b-2 transition-colors whitespace-nowrap" style={{
            background: tab === t ? "var(--surface-raised)" : "transparent",
            borderBottomColor: tab === t ? "var(--accent)" : "transparent",
            color: tab === t ? "var(--accent-text)" : "var(--text-muted)",
            border: "none",
            borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
          }}>{t}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "OVERVIEW" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
            <Metric label="BRENT CRUDE" value={`$${data.brent}`} unit="USD/BBL" change={data.brentChange} changeUnit="/bbl" />
            <Metric label="AUD/USD" value={data.audUsd.toFixed(3)} unit="" change={data.audUsdChange * 100} changeUnit="¢" />
            <Metric label="MEL DIESEL TGP" value={`${data.melbTGP}`} unit="¢/L" change={data.melbTGPChange} changeUnit="¢" highlight />
            <Metric label="DIESEL RESERVES" value={data.dieselReservesDays.toString()} unit="DAYS" />
            <Metric label="PETROL RESERVES" value={data.petrolReservesDays.toString()} unit="DAYS" />
            <Metric label="EXCISE CUT" value={`${data.exciseCutCPL}`} unit="¢/L" />
            <Metric label="FTC RATE" value={`${data.ftcRate}`} unit="¢/L" highlight />
            <Metric label="SUPPLY RISK" value={data.supplyRisk} unit="" />
          </div>

          {/* ALERT BANNERS */}
          <div className="flex flex-col gap-1.5">
            {[
              { color: "var(--negative)", icon: "⚠", text: "HORMUZ RESTRICTED — Gasoil inflows to Australia tracking -1.47M bbl vs January. April/May critical months." },
              { color: "var(--warning)", icon: "⏱", text: `EXCISE CLIFF IN ${daysToJuly} DAYS — Diesel TGP to spike +26–32¢/L on July 1 if not extended. All contracts must include escalation clauses.` },
              { color: "var(--positive)", icon: "✓", text: "NEW TRUCK TIMING OPTIMAL — Mobile delivery demand at historic high as retail stations report shortages. Market conditions favour your expansion." },
            ].map((a, i) => (
              <div key={i} className="flex gap-2.5 p-2.5 px-3.5 rounded-md text-xs items-start" style={{
                background: `color-mix(in srgb, ${a.color} 6%, transparent)`,
                border: `1px solid color-mix(in srgb, ${a.color} 20%, transparent)`,
                color: a.color,
              }}>
                <span>{a.icon}</span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>

          <AIBriefing data={data} trigger={briefingTrigger} />
        </div>
      )}

      {/* ── SUPPLY CHAIN TAB ── */}
      {tab === "SUPPLY CHAIN" && (
        <div className="flex flex-col gap-4">
          <div className="text-xs tracking-[2px] font-bold" style={{ color: "var(--accent-text)" }}>
            ▸ LIVE SUPPLY CHAIN STATUS — REFINED DIESEL TO MELBOURNE
          </div>

          {SUPPLY_CHAIN.map((item, i) => (
            <div key={i} className="glass-card grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center p-3 px-3.5 transition-colors hover:bg-surface-raised/50">
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.leg}</div>
                <div className="text-2xs" style={{ color: "var(--text-muted)" }}>{item.origin} → {item.dest}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status={item.status} />
                <span className="text-2xs tracking-wider" style={{ color: "var(--text-secondary)" }}>{item.status}</span>
              </div>
              <div className="text-right">
                <div className="text-2xs tracking-wider" style={{ color: "var(--text-muted)" }}>DISRUPTION RISK</div>
                <div className="text-sm font-bold" style={{ color: item.risk > 70 ? "var(--negative)" : item.risk > 40 ? "var(--warning)" : "var(--positive)" }}>
                  {item.risk}%
                </div>
              </div>
              <RiskBar value={item.risk} />
            </div>
          ))}

          {/* SHIPPING TIMELINE */}
          <div className="glass-card p-4">
            <div className="text-xs tracking-[2px] font-bold mb-3" style={{ color: "var(--accent-text)" }}>
              ▸ SAILING TIME COMPARISON
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
              {[
                { from: "Singapore", days: "10–14 days", cost: "NORMAL", status: "SECURED", color: "var(--positive)" },
                { from: "South Korea", days: "12–16 days", cost: "+15%", status: "REDUCED", color: "var(--warning)" },
                { from: "India", days: "14–18 days", cost: "+20%", status: "REDUCED", color: "var(--warning)" },
                { from: "Gulf of Mexico", days: "30–42 days", cost: "+60-80%", status: "ACTIVE (PREMIUM)", color: "var(--negative)" },
              ].map((r, i) => (
                <div key={i} className="rounded-md p-2.5 px-3" style={{ background: "var(--surface-raised)", borderLeft: `3px solid ${r.color}` }}>
                  <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{r.from}</div>
                  <div className="text-2xs" style={{ color: "var(--text-secondary)" }}>{r.days}</div>
                  <div className="text-2xs" style={{ color: "var(--text-muted)" }}>Cost premium: {r.cost}</div>
                  <div className="text-2xs font-bold mt-1" style={{ color: r.color }}>{r.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* REFINERY STATUS */}
          <div className="glass-card p-4">
            <div className="text-xs tracking-[2px] font-bold mb-3" style={{ color: "var(--accent-text)" }}>
              ▸ DOMESTIC REFINERY STATUS
            </div>
            {[
              { name: "Viva Energy — Geelong, VIC", cap: "120,000 bbl/day", status: "OPERATING", coverage: "~10% national demand", note: "Your local advantage. Closest terminal to PACC Dandenong operations." },
              { name: "Ampol Lytton — Brisbane, QLD", cap: "109,000 bbl/day", status: "OPERATING", coverage: "~10% national demand", note: "Full operation. Supplies QLD/NSW primarily." },
            ].map((r, i) => (
              <div key={i} className="rounded-md p-3 mb-2" style={{ background: "var(--surface-raised)" }}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.name}</span>
                  <span className="text-2xs font-bold" style={{ color: "var(--positive)" }}>{r.status}</span>
                </div>
                <div className="text-2xs mt-1" style={{ color: "var(--text-muted)" }}>Capacity: {r.cap} · Coverage: {r.coverage}</div>
                <div className="text-2xs mt-1" style={{ color: "var(--text-secondary)" }}>{r.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTH BY MONTH TAB ── */}
      {tab === "MONTH BY MONTH" && (
        <div className="flex flex-col gap-4">
          <div className="text-xs tracking-[2px] font-bold" style={{ color: "var(--accent-text)" }}>
            ▸ 4-MONTH OUTLOOK — DIESEL MARKET CONDITIONS FOR PACC FUEL
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
            {MONTHS.map((m, i) => (
              <div key={i} onClick={() => setActiveMonth(i)} className="cursor-pointer rounded-md p-4 transition-all" style={{
                background: activeMonth === i ? `color-mix(in srgb, ${m.color} 8%, var(--surface))` : "var(--surface-raised)",
                border: `1px solid ${activeMonth === i ? m.color : "var(--surface-border)"}`,
                borderTop: `4px solid ${m.color}`,
              }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{m.label}</span>
                  <span className="text-2xs px-2 py-0.5 rounded font-bold tracking-wider" style={{
                    background: `color-mix(in srgb, ${m.color} 12%, transparent)`, color: m.color,
                  }}>{m.signal}</span>
                </div>
                <div className="text-2xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{m.headline}</div>
              </div>
            ))}
          </div>

          <div className="glass-card p-4" style={{ background: "var(--surface-raised)" }}>
            <div className="text-xs tracking-[2px] font-bold mb-3" style={{ color: "var(--accent-text)" }}>
              {MONTHS[activeMonth].label} — ACTION ITEMS FOR PACC FUEL
            </div>
            {MONTHS[activeMonth].actions.map((a, i) => (
              <div key={i} className="flex gap-2 py-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--accent-text)" }}>→</span>
                <span>{a}</span>
              </div>
            ))}
          </div>

          {/* SCENARIO TABLE */}
          <div className="glass-card p-4 overflow-x-auto">
            <div className="text-xs tracking-[2px] font-bold mb-3" style={{ color: "var(--accent-text)" }}>
              ▸ SCENARIO PRICE TABLE — MELBOURNE DIESEL TGP (AUD ¢/L)
            </div>
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Scenario", "Brent (USD/bbl)", "AUD/USD", "Import Cost", "Pre-July TGP", "Post-July TGP"].map(h => (
                    <th key={h} className="text-left p-1.5 px-2 text-2xs tracking-wider" style={{ borderBottom: "1px solid var(--surface-border)", color: "var(--text-muted)" }}>{h}</th>
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
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="p-1.5 px-2 font-semibold" style={{ color: "var(--text-primary)" }}>{r.scenario}</td>
                    <td className="p-1.5 px-2" style={{ color: "var(--text-secondary)" }}>${r.brent}</td>
                    <td className="p-1.5 px-2" style={{ color: "var(--text-secondary)" }}>{r.aud}</td>
                    <td className="p-1.5 px-2" style={{ color: "var(--text-secondary)" }}>~{r.import_cost}¢</td>
                    <td className="p-1.5 px-2" style={{ color: "var(--text-secondary)" }}>{r.pre}¢</td>
                    <td className="p-1.5 px-2" style={{ color: "var(--text-secondary)" }}>{r.post}¢</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-2xs mt-2" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
              † Pre-July TGP assumes 32¢ excise relief active. Post-July assumes full excise 52.6¢ + GST restored.
            </div>
          </div>
        </div>
      )}

      {/* ── PACC IMPACT TAB ── */}
      {tab === "PACC IMPACT" && (
        <div className="flex flex-col gap-4">
          <div className="text-xs tracking-[2px] font-bold" style={{ color: "var(--accent-text)" }}>
            ▸ DIRECT BUSINESS IMPACT ANALYSIS — PACC FUEL MELBOURNE
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
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
              <div key={i} className="glass-card p-4">
                <div className="text-xs tracking-[2px] font-bold mb-3" style={{ color: panel.color }}>▸ {panel.title}</div>
                {panel.items.map((item, j) => (
                  <div key={j} className="flex justify-between items-center py-2" style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    background: item.highlight ? `color-mix(in srgb, ${panel.color} 4%, transparent)` : undefined,
                  }}>
                    <span className="text-2xs" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: item.highlight ? panel.color : "var(--text-primary)" }}>{item.value}</div>
                      <div className="text-2xs" style={{ color: "var(--text-muted)", opacity: 0.5 }}>{item.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* CHECKLIST */}
          <div className="glass-card p-4">
            <div className="text-xs tracking-[2px] font-bold mb-3" style={{ color: "var(--accent-text)" }}>
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
              <div key={i} className="flex gap-2.5 py-2 text-xs items-start" style={{
                borderBottom: "1px solid var(--border-subtle)",
                color: c.done ? "var(--positive)" : "var(--text-secondary)",
              }}>
                <span className="font-bold w-4 shrink-0">{c.done ? "✓" : "○"}</span>
                <span style={{ textDecoration: c.done ? "line-through" : undefined, opacity: c.done ? 0.6 : 1 }}>{c.item}</span>
              </div>
            ))}
          </div>

          {/* SOCIAL PROCUREMENT */}
          <div className="glass-card p-4">
            <div className="text-xs tracking-[2px] font-bold mb-2" style={{ color: "var(--accent-text)" }}>
              ▸ SOCIAL PROCUREMENT ANGLE — KELLER & CIVIL SECTOR
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Fuel shortages are hitting construction sites directly. Civil contractors (your Keller-type clients) are being charged 8–10% fuel surcharges by suppliers and are actively seeking guaranteed, on-site diesel delivery partners. Your mobile delivery model + social procurement certification = a compelling pitch during a shortage. Diesel-dependent plant — excavators, compactors, generators — cannot stop. You provide certainty when the servo down the road is dry.
            </p>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-6 pt-3 border-t border-surface-border text-center">
        <div className="text-2xs tracking-wider" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
          Data: AIP TGP · EIA STEO · Argus Media · Vortexa · PM&C · DCCEEW · ACCC
        </div>
        <div className="text-2xs tracking-wider mt-1" style={{ color: "var(--text-muted)", opacity: 0.3 }}>
          PACC FUEL INTELLIGENCE SYSTEM · {TODAY.getFullYear()} · AI BRIEFINGS VIA LOVABLE AI
        </div>
      </div>
    </div>
  );
}