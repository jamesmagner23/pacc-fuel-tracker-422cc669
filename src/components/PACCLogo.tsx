import { useDemoContext } from "@/hooks/useDemo";
import { BoldPMark } from "@/components/BoldPMark";

export function PACCLogo({
  size = "md",
  tone = "dark",
}: {
  size?: "sm" | "md";
  tone?: "dark" | "light";
}) {
  const { isDemo, brand, accentColor, isPaccBranded } = useDemoContext();

  const showPaccChrome = !isDemo || isPaccBranded;
  const displayName = showPaccChrome ? "PACC ENERGY" : brand || "FuelTrack";

  const fontSize = size === "sm" ? 13 : 16;
  const markSize = size === "sm" ? 24 : 30;

  // tone="dark" → ON dark surface (lime mark + cream wordmark)
  // tone="light" → ON cream/white surface (dark green mark + dark green wordmark)
  // Bold P mark colors. Always a high-contrast tile so the "P" reads even at small sizes.
  const markBg = showPaccChrome
    ? tone === "light"
      ? "#1A472A"
      : "#1A472A"
    : "#1A472A";
  const markFg = showPaccChrome
    ? "#C8F26A"
    : accentColor
      ? `hsl(${accentColor})`
      : "#C8F26A";

  const wordmarkColor = tone === "light"
    ? "#0E1F10"
    : showPaccChrome
      ? "#ECE4D2"
      : "#e8eaf0";

  const subtitleColor = tone === "light" ? "#3F4A3A" : "#8B8773";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {showPaccChrome && <BoldPMark size={markSize} bg={markBg} fg={markFg} rounded={6} />}
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontFamily: "'Archivo Narrow', 'Archivo', 'Inter', system-ui, sans-serif",
            fontSize,
            fontWeight: 800,
            color: wordmarkColor,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {displayName}
        </div>
        {showPaccChrome && (
          <div
            style={{
              fontSize: size === "sm" ? 7 : 8,
              fontWeight: 600,
              color: subtitleColor,
              letterSpacing: "0.22em",
              marginTop: 4,
              textTransform: "uppercase",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            POWERED BY PROGRESS
          </div>
        )}
      </div>
    </div>
  );
}
