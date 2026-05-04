import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "../theme";

interface Props {
  step: string;
  title: string;
  body: string;
}

export const Caption: React.FC<Props> = ({ step, title, body }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleEnter = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 120 } });
  const bodyEnter = spring({ frame: frame - 14, fps, config: { damping: 20, stiffness: 120 } });
  const stepEnter = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });

  const exit = interpolate(frame, [durationInFrames - 16, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        top: 200,
        width: 540,
        opacity: exit,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: T.accent,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          opacity: stepEnter,
          transform: `translateX(${interpolate(stepEnter, [0, 1], [-20, 0])}px)`,
          marginBottom: 24,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 36,
            height: 2,
            background: T.accent,
            verticalAlign: "middle",
            marginRight: 14,
          }}
        />
        {step}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 64,
          fontWeight: 800,
          color: T.text,
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          opacity: titleEnter,
          transform: `translateY(${interpolate(titleEnter, [0, 1], [22, 0])}px)`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          fontWeight: 400,
          color: T.textMuted,
          lineHeight: 1.45,
          opacity: bodyEnter,
          transform: `translateY(${interpolate(bodyEnter, [0, 1], [16, 0])}px)`,
        }}
      >
        {body}
      </div>
    </div>
  );
};