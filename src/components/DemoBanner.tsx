import { useDemoContext } from "@/hooks/useDemo";
import { Eye } from "lucide-react";

export function DemoBanner() {
  const { isDemo, brand, accentColor } = useDemoContext();
  if (!isDemo) return null;

  const bgColor = accentColor
    ? `hsl(${accentColor})`
    : "#3B82F6";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 200,
        background: bgColor,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "5px 16px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      <Eye style={{ width: 14, height: 14 }} />
      DEMO MODE{brand ? ` — ${brand}` : ""} — Sample data only
    </div>
  );
}
