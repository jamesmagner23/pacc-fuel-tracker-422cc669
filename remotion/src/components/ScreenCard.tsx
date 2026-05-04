import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { T } from "../theme";

interface Props {
  src: string;
  // pan direction: 0=center, +/- shifts in px over scene
  panX?: number;
  panY?: number;
  zoomFrom?: number;
  zoomTo?: number;
}

export const ScreenCard: React.FC<Props> = ({
  src,
  panX = 0,
  panY = -40,
  zoomFrom = 1.02,
  zoomTo = 1.08,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // entrance — spring lift + fade
  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 110 } });
  const lift = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  // exit — gentle fade
  const exit = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ken-burns
  const t = Math.min(1, frame / durationInFrames);
  const scale = interpolate(t, [0, 1], [zoomFrom, zoomTo]);
  const tx = interpolate(t, [0, 1], [0, panX]);
  const ty = interpolate(t, [0, 1], [0, panY]);

  return (
    <div
      style={{
        position: "absolute",
        right: 80,
        top: 120,
        width: 1180,
        height: 840,
        borderRadius: 18,
        overflow: "hidden",
        background: T.bgSoft,
        border: `1px solid ${T.border}`,
        boxShadow: `0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(240,74,26,0.08)`,
        transform: `translateY(${lift}px)`,
        opacity: opacity * exit,
      }}
    >
      {/* macOS-style title bar */}
      <div
        style={{
          height: 36,
          background: "#0f0703",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 16,
          gap: 8,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 18,
            color: T.textMuted,
            fontSize: 12,
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.04em",
          }}
        >
          paccenergy.com / portal
        </div>
      </div>
      <div style={{ width: "100%", height: "calc(100% - 36px)", overflow: "hidden" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
            transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
            transformOrigin: "center top",
          }}
        />
      </div>
    </div>
  );
};