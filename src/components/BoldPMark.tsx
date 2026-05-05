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

  // 7 cols × 7 rows P pattern (P glyph in cols 1–5, with empty cols 0 & 6
  // for symmetric horizontal padding that matches vertical padding).
  // 1 = dot, 0 = empty.
  const grid: number[][] = [
    [0, 1, 1, 1, 1, 0, 0], // row 0 — top of bowl
    [0, 1, 0, 0, 0, 1, 0], // row 1 — bowl sides
    [0, 1, 0, 0, 0, 1, 0], // row 2 — bowl sides
    [0, 1, 1, 1, 1, 0, 0], // row 3 — bottom of bowl
    [0, 1, 0, 0, 0, 0, 0], // row 4 — stem
    [0, 1, 0, 0, 0, 0, 0], // row 5 — stem
    [0, 1, 0, 0, 0, 0, 0], // row 6 — stem
  ];

  const cols = 7;
  const rows = 7;
  const step = 14;
  const dotR = step * 0.42; // ~5.88

  // Compute glyph bounding box from filled cells so we can center it
  // inside the tile — gives equal padding on all four sides.
  let minC = cols, maxC = -1, minR = rows, maxR = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
  }
  const glyphW = (maxC - minC) * step;
  const glyphH = (maxR - minR) * step;
  const offsetX = (100 - glyphW) / 2 - minC * step;
  const offsetY = (100 - glyphH) / 2 - minR * step;

  const dots: { cx: number; cy: number; r: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      dots.push({
        cx: offsetX + c * step,
        cy: offsetY + r * step,
        r: dotR,
      });
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