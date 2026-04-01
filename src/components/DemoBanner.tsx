import { useDemoContext } from "@/hooks/useDemo";
import { Eye } from "lucide-react";

export function DemoBanner() {
  const { isDemo, brand, accentColor } = useDemoContext();
  if (!isDemo) return null;

  const bgColor = accentColor
    ? `hsl(${accentColor})`
    : "linear-gradient(90deg, #E8461E, #FF6B42)";

  const bgStyle = accentColor
    ? { background: bgColor }
    : { background: "linear-gradient(90deg, #E8461E, #FF6B42)" };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        ...bgStyle,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "6px 16px",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      <Eye style={{ width: 14, height: 14 }} />
      DEMO MODE{brand ? ` — ${brand}` : ""} — Sample data only
    </div>
  );
}
