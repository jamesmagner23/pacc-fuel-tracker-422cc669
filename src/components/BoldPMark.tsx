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
  // Single-column stem (col 0) with a 4-wide closed bowl up top.
  // Symmetric horizontally about the bowl, evenly spaced.
  const grid: number[][] = [
    [1, 1, 1, 1, 0], // row 0 — top of bowl
    [1, 0, 0, 0, 1], // row 1 — bowl sides
    [1, 0, 0, 0, 1], // row 2 — bowl sides
    [1, 1, 1, 1, 0], // row 3 — bottom of bowl
    [1, 0, 0, 0, 0], // row 4 — stem
    [1, 0, 0, 0, 0], // row 5 — stem
    [1, 0, 0, 0, 0], // row 6 — stem
  ];

  const cols = 5;
  const rows = 7;
  // Layout inside 100×100 viewBox. Use equal step on both axes so dots are
  // perfectly square-spaced; the grid is then centred in the tile.
  const step = 14;
  const gridW = step * (cols - 1); // 56
  const gridH = step * (rows - 1); // 84
  const offsetX = (100 - gridW) / 2; // 22
  const offsetY = (100 - gridH) / 2; // 8
  // Uniform dot radius — symmetry over perspective.
  const dotR = step * 0.42; // ~5.88

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