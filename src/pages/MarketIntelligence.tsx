import { useState, useEffect, useRef, useCallback } from "react";

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
    label: "APR 2026", status: "NOW", color: "#f59e0b", signal: "CAUTION",
    headline: "Excise cut active. TGP down ~32¢ but import cost still elevated. New truck timing ideal — demand surging.",
    actions: ["Update FTC claim to 26.3¢/L", "Lock in customers at current margin", "Monitor AIP TGP daily"],
  },
  {
    label: "MAY 2026", status: "DANGER", color: "#ef4444", signal: "HIGH RISK",
    headline: "Lowest inbound gasoil month. Gulf of Mexico ships arrive but at premium cost. Localised shortages likely.",
    actions: ["Expect supply allocation pressure", "Prioritise contracted customers", "Watch May budget for excise extension"],
  },
  {
    label: "JUN 2026", status: "WATCH", color: "#f59e0b", signal: "WATCH",
    headline: "Supply stabilising if Hormuz reopens. May federal budget likely decides excise extension.",
    actions: ["Model July 1 reversion into all contracts", "Secure supply agreements pre-July", "Review fuel surcharge clauses"],
  },
  {
    label: "JUL 2026", status: "CLIFF", color: "#ef4444", signal: "CLIFF",
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
    BLOCKED: "#ef4444", RESTRICTED: "#ef4444", HIGH: "#ef4444",
    REDUCED: "#f59e0b", DIVERTED: "#f59e0b", MODERATE: "#f59e0b", WATCH: "#f59e0b",
    SECURED: "#10b981", OPERATING: "#10b981", ACTIVE: "#10b981", MODERATE_LOW: "#10b981",
  };
  const c = map[status] || "#6b7280";
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: c, boxShadow: `0 0 6px ${c}`, animation: status === "BLOCKED" || status === "RESTRICTED" ? "pulse 1.5s infinite" : undefined,
    }} />
  );
}

function RiskBar({ value }: { value: number }) {
  const c = value > 70 ? "#ef4444" : value > 40 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ width: 60, height: 4, background: "#1a2535", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: c, borderRadius: 2, transition: "width 0.5s" }} />
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
  const changeColor = neutral ? "#4b6280" : (up === isGood ? "#10b981" : "#ef4444");

  return (
    <div style={{
      background: highlight ? "#0f1a2e" : "#080f1a", border: `1px solid ${highlight ? "#f59e0b33" : "#1a2535"}`,
      borderRadius: 6, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ fontSize: 9, color: "#4b6280", letterSpacing: 2, fontFamily: "'Courier New',monospace" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: "#e8eef5", fontFamily: "'Courier New',monospace" }}>
        {value}<span style={{ fontSize: 11, color: "#4b6280", marginLeft: 2 }}>{unit}</span>
      </span>
      {change !== undefined && (
        <span style={{ fontSize: 10, color: changeColor, fontFamily: "'Courier New',monospace" }}>
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

      // Flush remaining
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

  useEffect(() => { generate(); }, [trigger]);

  // Parse sections for styled rendering
  const sections = text.split(/\*\*(.*?)\*\*/g);

  return (
    <div style={{ background: "#060e1a", border: "1px solid #1a2535", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ background: "#0a1525", padding: "14px 18px", borderBottom: "1px solid #1a2535" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: "#ef4444", letterSpacing: 3, fontFamily: "'Courier New',monospace", fontWeight: 700 }}>
              CLASSIFIED · DAILY INTELLIGENCE BRIEFING
            </div>
            <div style={{ fontSize: 11, color: "#4b6280", fontFamily: "'Courier New',monospace", marginTop: 2 }}>
              PACC FUEL MARKET ASSESSMENT
            </div>
            <div style={{ fontSize: 9, color: "#2a3a50", fontFamily: "'Courier New',monospace", marginTop: 4 }}>
              {ts ? `GENERATED: ${ts.toLocaleTimeString("en-AU")} AEST · ${fmtDate(TODAY)}` : "GENERATING…"}
            </div>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            style={{
              background: "#0f1a2e", border: "1px solid #1a2535", borderRadius: 4,
              color: loading ? "#f59e0b" : "#4b6280", fontSize: 10, cursor: loading ? "wait" : "pointer",
              padding: "6px 12px", fontFamily: "'Courier New',monospace", letterSpacing: 1,
            }}
          >
            {loading ? "⟳ UPDATING…" : "↻ REFRESH"}
          </button>
        </div>
      </div>

      <div style={{ padding: "18px", minHeight: 200 }}>
        {loading && !text && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                height: 12, background: "#0f1a2e", borderRadius: 4, width: `${85 - i * 10}%`,
                animation: "pulse 1.5s infinite", animationDelay: `${i * 0.2}s`,
              }} />
            ))}
            <div style={{ fontSize: 10, color: "#2a3a50", fontFamily: "'Courier New',monospace", marginTop: 8, letterSpacing: 2 }}>
              FETCHING INTELLIGENCE...
            </div>
          </div>
        )}

        {text && (
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 12, lineHeight: 1.7, color: "#8a9bb5" }}>
            {sections.map((seg, i) => {
              if (i % 2 === 1) {
                return (
                  <div key={i} style={{
                    color: "#f59e0b", fontSize: 11, fontWeight: 700, marginTop: 18, marginBottom: 6,
                    letterSpacing: 1, borderBottom: "1px solid #1a2535", paddingBottom: 4,
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
                        color: isBullet ? "#ef4444" : "#8a9bb5",
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
  const [data] = useState(SEED_DATA);
  const [briefingTrigger, setBriefingTrigger] = useState(0);
  const [activeMonth, setActiveMonth] = useState(0);
  const [tab, setTab] = useState("OVERVIEW");

  const tabs = ["OVERVIEW", "SUPPLY CHAIN", "MONTH BY MONTH", "PACC IMPACT"];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", fontFamily: "'Courier New', monospace" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .mi-tab:hover { background:#1a2535 !important; }
        .mi-month:hover { border-color:#f59e0b !important; cursor:pointer; }
        .mi-chain:hover { background:#0f1a2e !important; }
      `}</style>

      {/* HEADER */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>⛽</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e8eef5", letterSpacing: 3 }}>
              FUEL MARKET INTELLIGENCE
            </div>
            <div style={{ fontSize: 9, color: "#4b6280", letterSpacing: 2 }}>
              MELBOURNE · AUSTRALIA · DAILY BRIEFING SYSTEM
            </div>
          </div>
        </div>

        {/* LIVE TICKER */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 12px",
          background: "#060e1a", border: "1px solid #1a2535", borderRadius: 6, alignItems: "center",
        }}>
          {[
            { k: "BRENT", v: `$${data.brent}`, u: "USD/BBL", d: data.brentChange },
            { k: "AUD/USD", v: data.audUsd.toFixed(3), u: "", d: data.audUsdChange * 1000 },
            { k: "MEL TGP", v: `${data.melbTGP}¢`, u: "/L", d: data.melbTGPChange },
          ].map(item => (
            <div key={item.k} style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 12 }}>
              <span style={{ fontSize: 9, color: "#4b6280", letterSpacing: 1 }}>{item.k}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e8eef5" }}>
                {item.v}<span style={{ fontSize: 9, color: "#4b6280" }}>{item.u}</span>
              </span>
              <span style={{ fontSize: 10, color: item.d > 0 ? "#ef4444" : "#10b981" }}>
                {item.d > 0 ? "▲" : "▼"}{Math.abs(item.d).toFixed(1)}
              </span>
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 12 }}>
            <span style={{ fontSize: 9, color: "#4b6280", letterSpacing: 1 }}>HORMUZ</span>
            <StatusDot status="RESTRICTED" />
            <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>RESTRICTED</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <span style={{ fontSize: 9, color: "#4b6280" }}>EXCISE CLIFF</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>{daysToJuly}d</span>
            <span style={{ fontSize: 8, color: "#4b6280" }}>TO JUL 1</span>
          </div>
        </div>
      </div>

      {/* DATE BAR */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center",
        padding: "6px 12px", background: "#0a1525", borderRadius: 4, marginBottom: 8, gap: 8,
      }}>
        <span style={{ fontSize: 10, color: "#4b6280", letterSpacing: 1 }}>📅 {fmtDate(TODAY).toUpperCase()}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {[
            `Hormuz Crisis Active — Day ${Math.ceil((TODAY.getTime() - new Date("2026-02-28").getTime()) / 86400000)}`,
            "Excise Cut Active: 32¢/L relief",
            "Singapore Supply Agreement: SECURED",
          ].map((t, i) => (
            <span key={i} style={{ fontSize: 9, color: "#2a3a50", letterSpacing: 1 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a2535", marginBottom: 16, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t} className="mi-tab" onClick={() => setTab(t)} style={{
            background: tab === t ? "#0f1a2e" : "transparent",
            border: "none", borderBottom: tab === t ? "2px solid #f59e0b" : "2px solid transparent",
            color: tab === t ? "#f59e0b" : "#4b6280",
            padding: "10px 16px", fontSize: 10, letterSpacing: 2,
            fontFamily: "'Courier New',monospace", cursor: "pointer", whiteSpace: "nowrap",
          }}>{t}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "OVERVIEW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { color: "#ef4444", icon: "⚠", text: "HORMUZ RESTRICTED — Gasoil inflows to Australia tracking -1.47M bbl vs January. April/May critical months." },
              { color: "#f59e0b", icon: "⏱", text: `EXCISE CLIFF IN ${daysToJuly} DAYS — Diesel TGP to spike +26–32¢/L on July 1 if not extended. All contracts must include escalation clauses.` },
              { color: "#10b981", icon: "✓", text: "NEW TRUCK TIMING OPTIMAL — Mobile delivery demand at historic high as retail stations report shortages. Market conditions favour your expansion." },
            ].map((a, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, padding: "10px 14px", borderRadius: 6,
                background: `${a.color}0a`, border: `1px solid ${a.color}33`,
                fontSize: 11, color: a.color, fontFamily: "'Courier New',monospace", alignItems: "flex-start",
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700 }}>
            ▸ LIVE SUPPLY CHAIN STATUS — REFINED DIESEL TO MELBOURNE
          </div>

          {SUPPLY_CHAIN.map((item, i) => (
            <div key={i} className="mi-chain" style={{
              display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center",
              padding: "12px 14px", background: "#080f1a", border: "1px solid #1a2535",
              borderRadius: 6, transition: "background 0.15s",
            }}>
              <div>
                <div style={{ fontSize: 12, color: "#e8eef5", fontWeight: 600 }}>{item.leg}</div>
                <div style={{ fontSize: 9, color: "#4b6280" }}>{item.origin} → {item.dest}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <StatusDot status={item.status} />
                <span style={{ fontSize: 10, color: "#8a9bb5", letterSpacing: 1 }}>{item.status}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 8, color: "#4b6280", letterSpacing: 1 }}>DISRUPTION RISK</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: item.risk > 70 ? "#ef4444" : item.risk > 40 ? "#f59e0b" : "#10b981" }}>
                  {item.risk}%
                </div>
              </div>
              <RiskBar value={item.risk} />
            </div>
          ))}

          {/* SHIPPING TIMELINE */}
          <div style={{ background: "#080f1a", border: "1px solid #1a2535", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
              ▸ SAILING TIME COMPARISON
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {[
                { from: "Singapore", days: "10–14 days", cost: "NORMAL", status: "SECURED", color: "#10b981" },
                { from: "South Korea", days: "12–16 days", cost: "+15%", status: "REDUCED", color: "#f59e0b" },
                { from: "India", days: "14–18 days", cost: "+20%", status: "REDUCED", color: "#f59e0b" },
                { from: "Gulf of Mexico", days: "30–42 days", cost: "+60-80%", status: "ACTIVE (PREMIUM)", color: "#ef4444" },
              ].map((r, i) => (
                <div key={i} style={{ background: "#0a1525", borderRadius: 6, padding: "10px 12px", borderLeft: `3px solid ${r.color}` }}>
                  <div style={{ fontSize: 11, color: "#e8eef5", fontWeight: 600 }}>{r.from}</div>
                  <div style={{ fontSize: 10, color: "#8a9bb5" }}>{r.days}</div>
                  <div style={{ fontSize: 9, color: "#4b6280" }}>Cost premium: {r.cost}</div>
                  <div style={{ fontSize: 10, color: r.color, fontWeight: 700, marginTop: 4 }}>{r.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* REFINERY STATUS */}
          <div style={{ background: "#080f1a", border: "1px solid #1a2535", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
              ▸ DOMESTIC REFINERY STATUS
            </div>
            {[
              { name: "Viva Energy — Geelong, VIC", cap: "120,000 bbl/day", status: "OPERATING", coverage: "~10% national demand", note: "Your local advantage. Closest terminal to PACC Dandenong operations." },
              { name: "Ampol Lytton — Brisbane, QLD", cap: "109,000 bbl/day", status: "OPERATING", coverage: "~10% national demand", note: "Full operation. Supplies QLD/NSW primarily." },
            ].map((r, i) => (
              <div key={i} style={{ background: "#0a1525", borderRadius: 6, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#e8eef5", fontWeight: 600 }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700 }}>{r.status}</span>
                </div>
                <div style={{ fontSize: 10, color: "#4b6280", marginTop: 4 }}>Capacity: {r.cap} · Coverage: {r.coverage}</div>
                <div style={{ fontSize: 10, color: "#8a9bb5", marginTop: 4 }}>{r.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTH BY MONTH TAB ── */}
      {tab === "MONTH BY MONTH" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700 }}>
            ▸ 4-MONTH OUTLOOK — DIESEL MARKET CONDITIONS FOR PACC FUEL
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {MONTHS.map((m, i) => (
              <div key={i} className="mi-month" onClick={() => setActiveMonth(i)} style={{
                background: activeMonth === i ? `${m.color}15` : "#0a1525",
                border: `1px solid ${activeMonth === i ? m.color : "#1a2535"}`,
                borderTop: `4px solid ${m.color}`,
                borderRadius: 6, padding: 16, cursor: "pointer", transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#e8eef5", fontWeight: 700 }}>{m.label}</span>
                  <span style={{
                    fontSize: 9, padding: "2px 8px", borderRadius: 3,
                    background: `${m.color}22`, color: m.color, fontWeight: 700, letterSpacing: 1,
                  }}>{m.signal}</span>
                </div>
                <div style={{ fontSize: 10, color: "#8a9bb5", lineHeight: 1.5 }}>{m.headline}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#0a1525", border: "1px solid #1a2535", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
              {MONTHS[activeMonth].label} — ACTION ITEMS FOR PACC FUEL
            </div>
            {MONTHS[activeMonth].actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: 11, color: "#8a9bb5" }}>
                <span style={{ color: "#f59e0b" }}>→</span>
                <span>{a}</span>
              </div>
            ))}
          </div>

          {/* SCENARIO TABLE */}
          <div style={{ background: "#080f1a", border: "1px solid #1a2535", borderRadius: 8, padding: 16, overflowX: "auto" }}>
            <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
              ▸ SCENARIO PRICE TABLE — MELBOURNE DIESEL TGP (AUD ¢/L)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Scenario", "Brent (USD/bbl)", "AUD/USD", "Import Cost", "Pre-July TGP", "Post-July TGP"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #1a2535", color: "#4b6280", fontSize: 9, letterSpacing: 1 }}>{h}</th>
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
                  <tr key={i} style={{ borderBottom: "1px solid #0f1a2e" }}>
                    <td style={{ padding: "6px 8px", color: "#e8eef5", fontWeight: 600 }}>{r.scenario}</td>
                    <td style={{ padding: "6px 8px", color: "#8a9bb5" }}>${r.brent}</td>
                    <td style={{ padding: "6px 8px", color: "#8a9bb5" }}>{r.aud}</td>
                    <td style={{ padding: "6px 8px", color: "#8a9bb5" }}>~{r.import_cost}¢</td>
                    <td style={{ padding: "6px 8px", color: "#8a9bb5" }}>{r.pre}¢</td>
                    <td style={{ padding: "6px 8px", color: "#8a9bb5" }}>{r.post}¢</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 9, color: "#2a3a50", marginTop: 8 }}>
              † Pre-July TGP assumes 32¢ excise relief active. Post-July assumes full excise 52.6¢ + GST restored.
            </div>
          </div>
        </div>
      )}

      {/* ── PACC IMPACT TAB ── */}
      {tab === "PACC IMPACT" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700 }}>
            ▸ DIRECT BUSINESS IMPACT ANALYSIS — PACC FUEL MELBOURNE
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {[
              {
                title: "FUEL TAX CREDIT — UPDATE REQUIRED", color: "#10b981",
                items: [
                  { label: "FTC Rate (was)", value: "20.2¢/L", note: "on-road heavy vehicles" },
                  { label: "FTC Rate (NOW)", value: "26.3¢/L", note: "effective 1 Apr – 30 Jun 2026", highlight: true },
                  { label: "Extra claim per 1,000L", value: "+$61", note: "update your BAS immediately" },
                  { label: "RUC (was)", value: "32.4¢/L", note: "heavy vehicle road user charge" },
                  { label: "RUC (NOW)", value: "ZERO", note: "zeroed until June 30", highlight: true },
                ],
              },
              {
                title: "NEW TRUCK — MARKET TIMING", color: "#f59e0b",
                items: [
                  { label: "Retail station shortages (VIC)", value: "~10%", note: "of outlets reporting outages" },
                  { label: "Demand spike vs normal", value: "+40-50%", note: "March peak, stabilising now" },
                  { label: "Independent operators", value: "RATIONED", note: "non-contracted buyers cut first" },
                  { label: "PACC contracted supply", value: "SECURED", note: "your moat vs competitors", highlight: true },
                  { label: "Optimal launch window", value: "NOW → MAY", note: "before shortages ease and demand normalises" },
                ],
              },
            ].map((panel, i) => (
              <div key={i} style={{ background: "#080f1a", border: "1px solid #1a2535", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: panel.color, letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>▸ {panel.title}</div>
                {panel.items.map((item, j) => (
                  <div key={j} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid #0f1a2e",
                    background: item.highlight ? `${panel.color}08` : undefined,
                  }}>
                    <span style={{ fontSize: 10, color: "#4b6280" }}>{item.label}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: item.highlight ? panel.color : "#e8eef5", fontWeight: 700 }}>{item.value}</div>
                      <div style={{ fontSize: 9, color: "#2a3a50" }}>{item.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* CHECKLIST */}
          <div style={{ background: "#080f1a", border: "1px solid #1a2535", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
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
              <div key={i} style={{
                display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #0f1a2e",
                fontSize: 11, color: c.done ? "#10b981" : "#8a9bb5", alignItems: "flex-start",
              }}>
                <span style={{ fontWeight: 700, width: 16, flexShrink: 0 }}>{c.done ? "✓" : "○"}</span>
                <span style={{ textDecoration: c.done ? "line-through" : undefined, opacity: c.done ? 0.6 : 1 }}>{c.item}</span>
              </div>
            ))}
          </div>

          {/* SOCIAL PROCUREMENT */}
          <div style={{ background: "#080f1a", border: "1px solid #1a2535", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>
              ▸ SOCIAL PROCUREMENT ANGLE — KELLER & CIVIL SECTOR
            </div>
            <p style={{ fontSize: 11, color: "#8a9bb5", lineHeight: 1.7 }}>
              Fuel shortages are hitting construction sites directly. Civil contractors (your Keller-type clients) are being charged 8–10% fuel surcharges by suppliers and are actively seeking guaranteed, on-site diesel delivery partners. Your mobile delivery model + social procurement certification = a compelling pitch during a shortage. Diesel-dependent plant — excavators, compactors, generators — cannot stop. You provide certainty when the servo down the road is dry.
            </p>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ marginTop: 24, padding: "12px 0", borderTop: "1px solid #1a2535", textAlign: "center" }}>
        <div style={{ fontSize: 8, color: "#2a3a50", letterSpacing: 1 }}>
          Data: AIP TGP · EIA STEO · Argus Media · Vortexa · PM&C · DCCEEW · ACCC
        </div>
        <div style={{ fontSize: 8, color: "#1a2535", letterSpacing: 1, marginTop: 4 }}>
          PACC FUEL INTELLIGENCE SYSTEM · {TODAY.getFullYear()} · AI BRIEFINGS VIA LOVABLE AI
        </div>
      </div>
    </div>
  );
}
