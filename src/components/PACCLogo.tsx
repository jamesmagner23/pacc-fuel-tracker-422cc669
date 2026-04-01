import { useDemoContext } from "@/hooks/useDemo";

export function PACCLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const { isDemo, brand, accentColor } = useDemoContext();
  const fontSize = size === "sm" ? 14 : 17;

  const displayName = isDemo && brand ? brand : "PACC";
  const accentStyle = accentColor ? `hsl(${accentColor})` : "#E8461E";
  const showSubtitle = !brand; // Only show "FUEL" subtitle for default branding

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontSize,
            fontWeight: 800,
            color: "#F5E6D0",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {displayName}
          {!brand && (
            <span style={{ color: accentStyle, fontSize: fontSize * 0.65 }}>®</span>
          )}
        </div>
        {showSubtitle && (
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
