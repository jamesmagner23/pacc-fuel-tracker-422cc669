import { useDemoContext } from "@/hooks/useDemo";
import { BoldPMark } from "@/components/BoldPMark";
import { useGlobalTheme } from "@/lib/globalTheme";

export function PACCLogo({
  size = "md",
  tone,
}: {
  size?: "sm" | "md";
  tone?: "dark" | "light";
}) {
  const { isDemo, brand, accentColor, isPaccBranded } = useDemoContext();
  // Use the canonical theme hook so the wordmark colour can never drift from
  // the active global theme (the previous data-attribute polling approach had
  // race conditions that left the header logo cream-on-white in light mode).
  const { isDark } = useGlobalTheme();
  const effectiveTone: "dark" | "light" = tone ?? (isDark ? "dark" : "light");

  const showPaccChrome = !isDemo || isPaccBranded;
  const displayName = showPaccChrome ? "PACC ENERGY" : brand || "FuelTrack";

  const fontSize = size === "sm" ? 13 : 16;
  const markSize = size === "sm" ? 24 : 30;

  // tone="dark" → ON dark surface (lime mark + cream wordmark)
  // tone="light" → ON cream/white surface (dark green mark + dark green wordmark)
  // Bold P mark colors. Always a high-contrast tile so the "P" reads even at small sizes.
  const markBg = "#1A472A";
  const markFg = showPaccChrome
    ? "#C8F26A"
    : accentColor
      ? `hsl(${accentColor})`
      : "#C8F26A";

  const wordmarkColor = effectiveTone === "light"
    ? "#0E1F10"
    : showPaccChrome
      ? "#ECE4D2"
      : "#e8eaf0";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {showPaccChrome && <BoldPMark size={markSize} bg={markBg} fg={markFg} rounded={6} />}
      <div style={{ lineHeight: 1, whiteSpace: "nowrap" }}>
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
      </div>
    </div>
  );
}
