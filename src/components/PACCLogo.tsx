import { useDemoContext } from "@/hooks/useDemo";

/**
 * Dotted "P" mark — built from the PACC ENERGY brand guide.
 * 5-col x 6-row dot grid. Lit dots form a stylized P.
 */
function DottedP({ size = 22, color = "#C8F26A" }: { size?: number; color?: string }) {
  // 1 = visible dot
  const grid = [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
  ];
  const cols = 5;
  const rows = 6;
  const cell = 100 / cols;
  const r = cell * 0.32;
  const w = size;
  const h = (size * rows) / cols;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 100 ${(100 * rows) / cols}`}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {grid.flatMap((row, y) =>
        row.map((on, x) =>
          on ? (
            <circle
              key={`${x}-${y}`}
              cx={x * cell + cell / 2}
              cy={y * cell + cell / 2}
              r={r}
              fill={color}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

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
  const markSize = size === "sm" ? 18 : 22;

  // tone="dark" → ON dark surface (lime mark + cream wordmark)
  // tone="light" → ON cream/white surface (dark green mark + dark green wordmark)
  const markColor = showPaccChrome
    ? tone === "light"
      ? "#3F6B36"
      : "#C8F26A"
    : accentColor
      ? `hsl(${accentColor})`
      : "#3B82F6";

  const wordmarkColor = tone === "light"
    ? "#0E1F10"
    : showPaccChrome
      ? "#ECE4D2"
      : "#e8eaf0";

  const subtitleColor = tone === "light" ? "#3F4A3A" : "#8B8773";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {showPaccChrome && <DottedP size={markSize} color={markColor} />}
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
