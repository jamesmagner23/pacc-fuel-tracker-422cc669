import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { T } from "../theme";

/**
 * Dedicated FTC breakdown scene — left side is the standard caption,
 * right side is a designed "panel" showing the per-litre formula and
 * a category-level rollup, animated row by row.
 */

const ROWS = [
  { name: "Machinery & Plant (off-road)", litres: 19_970, rate: 49.6, claim: 9_905.12 },
  { name: "Heavy Vehicles on public road (>4.5t)", litres: 930, rate: 20.4, claim: 189.72 },
  { name: "Light Vehicles", litres: 883, rate: 0.0, claim: 0 },
];

const TOTAL = 10_094.84;
const PERIOD = "May 2026";

function fmtMoney(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const FtcScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const panelEnter = spring({ frame: frame - 6, fps, config: { damping: 22, stiffness: 110 } });
  const exit = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Total counter — count up over ~30 frames after a small delay
  const totalProgress = interpolate(frame, [40, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const animatedTotal = TOTAL * totalProgress;

  return (
    <AbsoluteFill>
      <Caption
        step="09 · Fuel Tax Credit"
        title="Every litre, claimed."
        body="Each delivered litre is multiplied by the ATO rate for its equipment category, then summed across the period — your indicative claim, ready for your accountant."
      />

      {/* Right-hand FTC panel */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 140,
          width: 1100,
          padding: "44px 52px",
          borderRadius: 22,
          background: T.bgSoft,
          border: `1px solid ${T.border}`,
          boxShadow: `0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(200,242,106,0.10)`,
          opacity: panelEnter * exit,
          transform: `translateY(${interpolate(panelEnter, [0, 1], [40, 0])}px)`,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Header: title + animated total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.textMuted,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              Fuel Tax Credit Estimate
            </div>
            <div style={{ fontSize: 14, color: T.textMuted, marginTop: 6 }}>
              {PERIOD} · Litres × ATO rate per category
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.textMuted,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              Total claimable
            </div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: T.accent,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
                marginTop: 6,
                lineHeight: 1,
              }}
            >
              {fmtMoney(animatedTotal)}
            </div>
          </div>
        </div>

        {/* Formula chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 20px",
            borderRadius: 999,
            background: "rgba(63,122,54,0.08)",
            border: `1px solid rgba(63,122,54,0.25)`,
            marginBottom: 28,
          }}
        >
          <span style={{ color: T.text, fontSize: 16, fontWeight: 600 }}>Litres delivered</span>
          <span style={{ color: T.accent, fontSize: 18, fontWeight: 800 }}>×</span>
          <span style={{ color: T.text, fontSize: 16, fontWeight: 600 }}>ATO rate (c/L)</span>
          <span style={{ color: T.accent, fontSize: 18, fontWeight: 800 }}>=</span>
          <span style={{ color: T.accent, fontSize: 16, fontWeight: 700 }}>Claim per category</span>
        </div>

        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 1fr 1fr 1.1fr",
            gap: 16,
            paddingBottom: 12,
            borderBottom: `1px solid ${T.border}`,
            fontSize: 11,
            fontWeight: 700,
            color: T.textMuted,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <div>Category</div>
          <div style={{ textAlign: "right" }}>Litres</div>
          <div style={{ textAlign: "right" }}>Rate (c/L)</div>
          <div style={{ textAlign: "right" }}>Claim</div>
        </div>

        {/* Rows — staggered enter */}
        {ROWS.map((r, i) => {
          const rowStart = 18 + i * 10;
          const rowEnter = spring({ frame: frame - rowStart, fps, config: { damping: 22, stiffness: 130 } });
          return (
            <div
              key={r.name}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1fr 1fr 1.1fr",
                gap: 16,
                padding: "18px 0",
                borderBottom: `1px solid ${T.border}`,
                fontSize: 18,
                color: T.text,
                fontVariantNumeric: "tabular-nums",
                opacity: rowEnter,
                transform: `translateY(${interpolate(rowEnter, [0, 1], [16, 0])}px)`,
              }}
            >
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ textAlign: "right" }}>{r.litres.toLocaleString()}</div>
              <div style={{ textAlign: "right", color: T.textMuted }}>{r.rate.toFixed(1)}</div>
              <div
                style={{
                  textAlign: "right",
                  fontWeight: 700,
                  color: r.claim > 0 ? T.accent : T.textMuted,
                }}
              >
                {r.claim > 0 ? fmtMoney(r.claim) : "$0"}
              </div>
            </div>
          );
        })}

        {/* Footnote */}
        <div
          style={{
            marginTop: 22,
            fontSize: 13,
            color: T.textMuted,
            lineHeight: 1.5,
          }}
        >
          Sums across the selected period (today / week / month / all-time). Indicative —
          confirm with your accountant before lodging your BAS.
        </div>
      </div>
    </AbsoluteFill>
  );
};