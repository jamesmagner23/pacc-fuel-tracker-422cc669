import { useDemoContext } from "@/hooks/useDemo";

export function PACCLogo({ size = "md", tone = "dark" }: { size?: "sm" | "md"; tone?: "dark" | "light" }) {
  const { isDemo, brand, accentColor, isPaccBranded } = useDemoContext();
  const fontSize = size === "sm" ? 14 : 17;

  // PACC-branded demo renders identical to production
  const showPaccChrome = !isDemo || isPaccBranded;
  const displayName = showPaccChrome ? "PACC" : (brand || "FuelTrack");
  const accentStyle = !showPaccChrome
    ? (accentColor ? `hsl(${accentColor})` : "#3B82F6")
    : "#E8461E";

  // tone="dark" → designed to sit ON a dark surface (cream wordmark)
  // tone="light" → designed to sit ON a light/cream surface (deep-brown wordmark)
  const wordmarkColor = tone === "light"
    ? "#3D2B1A"
    : (showPaccChrome ? "#F5E6D0" : "#e8eaf0");
  const subtitleColor = tone === "light" ? "#6B5240" : "#C4A882";

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontSize,
            fontWeight: 800,
            color: wordmarkColor,
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
              color: subtitleColor,
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
