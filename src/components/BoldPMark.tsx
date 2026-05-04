/**
 * Halftone dot-grid "P" mark — matches the dotted reference logo.
 * 5 columns × 7 rows of circles forming a "P". Dot radius shrinks
 * left → right to create the perspective/halftone effect.
 */
export function BoldPMark({
  size = 28,
  bg = "#1A472A",
  fg = "#D4ED31",
  rounded = 6,
  bleed = false,
}: {
  size?: number;
  bg?: string;
  fg?: string;
  rounded?: number;
  bleed?: boolean;
}) {
  const tileRadius = bleed ? 0 : (rounded * 100) / size;

  // 5 cols × 7 rows P pattern. 1 = dot, 0 = empty.
  // Shape: stem on cols 0-1 all rows; bowl top row 0 cols 2-3;
  // right edge col 4 rows 1-2; bowl bottom row 3 cols 2-3.
  const grid: number[][] = [
    [1, 1, 1, 1, 0], // row 0 — top of bowl
    [1, 1, 0, 0, 1], // row 1
    [1, 1, 0, 0, 1], // row 2
    [1, 1, 1, 1, 0], // row 3 — bottom of bowl
    [1, 1, 0, 0, 0], // row 4 — stem
    [1, 1, 0, 0, 0], // row 5 — stem
    [1, 1, 0, 0, 0], // row 6 — stem
  ];

  const cols = 5;
  const rows = 7;
  // Layout inside 100×100 viewBox with margin so dots don't kiss the edge.
  const marginX = 10;
  const marginY = 8;
  const stepX = (100 - marginX * 2) / (cols - 1); // 20
  const stepY = (100 - marginY * 2) / (rows - 1); // 14
  // Base dot radius — slightly under half a step so dots breathe.
  const baseR = Math.min(stepX, stepY) * 0.42; // ~5.88
  // Perspective shrink: leftmost col = 100%, rightmost col = 62%.
  const minScale = 0.62;

  const dots: { cx: number; cy: number; r: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      const cx = marginX + c * stepX;
      const cy = marginY + r * stepY;
      const t = c / (cols - 1); // 0..1 left→right
      const scale = 1 - (1 - minScale) * t;
      dots.push({ cx, cy, r: baseR * scale });
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block", borderRadius: rounded }}
    >
      <rect x="0" y="0" width="100" height="100" rx={tileRadius} fill={bg} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={fg} />
      ))}
    </svg>
  );
}