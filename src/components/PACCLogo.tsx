import { useDemoContext } from "@/hooks/useDemo";

export function PACCLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const { isDemo, brand, accentColor, isPaccBranded } = useDemoContext();
  const fontSize = size === "sm" ? 14 : 17;

  // PACC-branded demo renders identical to production
  const showPaccChrome = !isDemo || isPaccBranded;
  const displayName = showPaccChrome ? "PACC" : (brand || "FuelTrack");
  const accentStyle = !showPaccChrome
    ? (accentColor ? `hsl(${accentColor})` : "#3B82F6")
    : "#E8461E";

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontSize,
            fontWeight: 800,
            color: showPaccChrome ? "#F5E6D0" : "#e8eaf0",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {displayName}
          {showPaccChrome && (
            <span style={{ color: accentStyle, fontSize: fontSize * 0.65 }}>®</span>
          )}
        </div>
        {showPaccChrome && (
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
