export function PACCLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const fontSize = size === "sm" ? 14 : 17;

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
          PACC<span style={{ color: "#E8461E", fontSize: fontSize * 0.65 }}>®</span>
        </div>
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
      </div>
    </div>
  );
}
