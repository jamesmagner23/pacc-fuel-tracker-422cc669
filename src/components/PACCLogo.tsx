import { useDemoContext } from "@/hooks/useDemo";

export function PACCLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const { isDemo, brand, accentColor } = useDemoContext();
  const fontSize = size === "sm" ? 14 : 17;

  const displayName = isDemo ? (brand || "FuelTrack") : "PACC";
  const accentStyle = isDemo
    ? (accentColor ? `hsl(${accentColor})` : "#3B82F6")
    : "#E8461E";

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontSize,
            fontWeight: 800,
            color: isDemo ? "#e8eaf0" : "#F5E6D0",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {displayName}
          {!isDemo && (
            <span style={{ color: accentStyle, fontSize: fontSize * 0.65 }}>®</span>
          )}
        </div>
        {!isDemo && (
          <div
            style={{
              fontSize: size === "sm" ? 7 : 8,
              fontWeight: 500,
              color: "#C4A882",
              letterSpacing: "0.15em",
              marginTop: 3,
              textTransform: "uppercase",
            }}
          >
            FUEL
          </div>
        )}
      </div>
    </div>
  );
}
