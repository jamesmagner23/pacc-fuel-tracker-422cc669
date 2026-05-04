import { AbsoluteFill, useCurrentFrame } from "remotion";
import { T } from "../theme";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  // slow drifting radial glow
  const x = 50 + Math.sin(frame / 90) * 8;
  const y = 50 + Math.cos(frame / 120) * 6;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, ${T.bgSoft} 0%, ${T.bg} 55%, #E8DFC8 100%)`,
      }}
    />
  );
};