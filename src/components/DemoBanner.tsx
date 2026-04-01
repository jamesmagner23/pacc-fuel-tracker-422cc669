import { useDemo } from "@/hooks/useDemo";
import { Eye } from "lucide-react";

export function DemoBanner() {
  const isDemo = useDemo();
  if (!isDemo) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: "linear-gradient(90deg, #E8461E, #FF6B42)",
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
      DEMO MODE — Sample data only
    </div>
  );
}
