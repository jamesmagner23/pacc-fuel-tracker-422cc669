import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "../theme";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const a = spring({ frame, fps, config: { damping: 20, stiffness: 110 } });
  const b = spring({ frame: frame - 14, fps, config: { damping: 22, stiffness: 110 } });
  const c = spring({ frame: frame - 28, fps, config: { damping: 22, stiffness: 110 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          color: T.accent,
          letterSpacing: "0.4em",
          fontWeight: 700,
          marginBottom: 28,
          opacity: a,
        }}
      >
        SEE THE LIVE DEMO
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 96,
          fontWeight: 800,
          color: T.text,
          letterSpacing: "-0.03em",
          textAlign: "center",
          opacity: a,
          transform: `translateY(${interpolate(a, [0, 1], [24, 0])}px)`,
        }}
      >
        paccenergy.com<span style={{ color: T.accent }}>/portal</span>
      </div>
      <div
        style={{
          marginTop: 36,
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          color: T.textMuted,
          opacity: b,
        }}
      >
        Sample data. No signup required.
      </div>
      <div
        style={{
          marginTop: 60,
          padding: "16px 36px",
          borderRadius: 999,
          background: T.accent,
          color: T.cream,
          fontFamily: "Inter, sans-serif",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          opacity: c,
          transform: `scale(${interpolate(c, [0, 1], [0.85, 1])})`,
        }}
      >
        Try the portal →
      </div>
    </AbsoluteFill>
  );
};