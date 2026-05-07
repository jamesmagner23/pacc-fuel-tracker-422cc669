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

  // 5 cols × 7 rows P glyph — closed bowl on top, long stem below,
  // matching the dotted PACC ENERGY reference logo.
  const grid: number[][] = [
    [1, 1, 1, 1, 0], // row 0 — top of bowl
    [1, 0, 0, 0, 1], // row 1 — bowl side
    [1, 0, 0, 0, 1], // row 2 — bowl side
    [1, 1, 1, 1, 0], // row 3 — bottom of bowl
    [1, 0, 0, 0, 0], // row 4 — stem
    [1, 0, 0, 0, 0], // row 5 — stem
    [1, 0, 0, 0, 0], // row 6 — stem
  ];

  const cols = 5;
  const rows = 7;
  // Choose step so the glyph's outer dot-edges leave a uniform `pad` on
  // every side of the 100-unit tile.
  // glyphSpan + 2*dotR + 2*pad = 100, where glyphSpan = (n-1)*step and dotR = 0.42*step.
  const pad = 12;
  const stepX = (100 - 2 * pad) / ((cols - 1) + 2 * 0.42);
  const stepY = (100 - 2 * pad) / ((rows - 1) + 2 * 0.42);
  const step = Math.min(stepX, stepY);
  const dotR = step * 0.42;

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