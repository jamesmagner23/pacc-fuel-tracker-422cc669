import { useEffect, useState } from "react";
import { useDemoContext } from "@/hooks/useDemo";
import { BoldPMark } from "@/components/BoldPMark";

export function PACCLogo({
  size = "md",
  tone,
}: {
  size?: "sm" | "md";
  tone?: "dark" | "light";
}) {
  const { isDemo, brand, accentColor, isPaccBranded } = useDemoContext();

  // Auto-detect global theme so the wordmark stays legible on cream/light surfaces.
  const [autoTone, setAutoTone] = useState<"dark" | "light">(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  });
  useEffect(() => {
    const update = () => {
      setAutoTone(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    };
    update();
    window.addEventListener("pacc:global-theme", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("pacc:global-theme", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  const effectiveTone = tone ?? autoTone;

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

  const subtitleColor = effectiveTone === "light" ? "#3F4A3A" : "#8B8773";

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
