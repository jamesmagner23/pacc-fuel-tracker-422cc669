import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "../theme";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const wordmarkEnter = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const subEnter = spring({ frame: frame - 18, fps, config: { damping: 22, stiffness: 110 } });
  const lineGrow = interpolate(frame, [22, 60], [0, 1], { extrapolateRight: "clamp" });
  const exit = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: exit }}>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 18,
          color: T.accent,
          letterSpacing: "0.4em",
          fontWeight: 700,
          marginBottom: 36,
          opacity: wordmarkEnter,
          transform: `translateY(${interpolate(wordmarkEnter, [0, 1], [16, 0])}px)`,
        }}
      >
        PACC ENERGY
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 128,
          fontWeight: 800,
          color: T.text,
          letterSpacing: "-0.04em",
          textAlign: "center",
          lineHeight: 1,
          opacity: wordmarkEnter,
          transform: `translateY(${interpolate(wordmarkEnter, [0, 1], [40, 0])}px)`,
        }}
      >
        Your fuel,
        <br />
        <span style={{ color: T.accent }}>in real time.</span>
      </div>
      <div
        style={{
          width: 220 * lineGrow,
          height: 3,
          background: T.accent,
          marginTop: 44,
          marginBottom: 28,
          transition: "none",
        }}
      />
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          color: T.textMuted,
          letterSpacing: "0.04em",
          opacity: subEnter,
          transform: `translateY(${interpolate(subEnter, [0, 1], [10, 0])}px)`,
        }}
      >
        A 30-second tour of the customer portal
      </div>
    </AbsoluteFill>
  );
};