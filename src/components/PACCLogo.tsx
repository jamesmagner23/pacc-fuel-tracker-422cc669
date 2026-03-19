export function PACCLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const barWidth = size === "sm" ? 18 : 22;
  const barHeight = size === "sm" ? 2 : 2.5;
  const gap = size === "sm" ? 3 : 3.5;
  const fontSize = size === "sm" ? 13 : 16;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size === "sm" ? 8 : 10 }}>
      {/* Stacked bars */}
      <div style={{ display: "flex", flexDirection: "column", gap, flexShrink: 0 }}>
        <div style={{ width: barWidth, height: barHeight, background: "#ffffff", borderRadius: 1 }} />
        <div style={{ width: barWidth * 0.75, height: barHeight, background: "#ffffff", borderRadius: 1 }} />
        <div style={{ width: barWidth * 0.5, height: barHeight, background: "#ffffff", borderRadius: 1 }} />
      </div>

      {/* Wordmark */}
      <div style={{
        fontSize,
        fontWeight: 800,
        color: "#ffffff",
        letterSpacing: "-0.02em",
        textTransform: "uppercase",
        fontFamily: "'Inter', system-ui, sans-serif",
        lineHeight: 1,
      }}>
        PACC<span style={{ color: "#7C3AED" }}>®</span>
        <div style={{ fontSize: size === "sm" ? 8 : 9, fontWeight: 500, color: "#333333", letterSpacing: "0.12em", marginTop: 2 }}>
          FUEL
        </div>
      </div>
    </div>
  );
}
