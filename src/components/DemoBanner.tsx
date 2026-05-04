import { useDemoContext } from "@/hooks/useDemo";
import { useLocation } from "react-router-dom";
import { Eye } from "lucide-react";

export function DemoBanner() {
  const { isDemo, brand, accentColor, isPaccBranded } = useDemoContext();
  const location = useLocation();

  // Hide banner on docket pages so it doesn't interfere with print layout
  if (!isDemo || location.pathname.startsWith("/docket")) return null;
  if (!isDemo) return null;

  const bgColor = isPaccBranded
    ? "#C8F26A"
    : (accentColor ? `hsl(${accentColor})` : "#C8F26A");

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
