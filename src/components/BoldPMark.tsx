/**
 * Bold solid "P" mark — matches the app favicon (lime P on forest tile).
 * Use this anywhere the brand mark needs maximum contrast (nav, login, portals).
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
  // Dotted "P" mark — halftone style matching the PACC brand reference.
  // 5-column × 7-row grid. `2` = full dot, `1` = small dot, `0` = empty.
  const grid: number[][] = [
    [2, 2, 2, 2, 1], // top of bowl
    [2, 2, 0, 2, 1],
    [2, 2, 0, 2, 1],
    [2, 2, 2, 2, 1], // bottom of bowl
    [2, 2, 0, 0, 0], // stem only
    [2, 2, 0, 0, 0],
    [2, 2, 0, 0, 0],
  ];

  const cols = 5;
  const rows = 7;
  // 100x100 viewBox, with margin so dots have breathing room.
  const margin = 6;
  const cellW = (100 - margin * 2) / cols;
  const cellH = (100 - margin * 2) / rows;
  const cell = Math.min(cellW, cellH);
  const gridW = cell * cols;
  const gridH = cell * rows;
  const offsetX = (100 - gridW) / 2;
  const offsetY = (100 - gridH) / 2;
  const fullR = cell * 0.42;
  const smallR = cell * 0.22;
  const tileRadius = bleed ? 0 : (rounded * 100) / size;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block", borderRadius: rounded }}
    >
      <rect x="0" y="0" width="100" height="100" rx={tileRadius} fill={bg} />
      {grid.flatMap((row, r) =>
        row.map((v, c) => {
          if (!v) return null;
          const cx = offsetX + cell * (c + 0.5);
          const cy = offsetY + cell * (r + 0.5);
          return <circle key={`${r}-${c}`} cx={cx} cy={cy} r={v === 2 ? fullR : smallR} fill={fg} />;
        })
      )}
    </svg>
  );
}