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
  // 100x100 viewBox; same geometry as public/icon-*.png generator.
  // Stem on left, bowl on top half with cut-out, matching favicon.
  const pad = bleed ? 10 : 14;
  const inner = 100 - pad * 2;
  const stemW = inner * 0.22;
  const bowlH = inner * 0.58;
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + inner;
  const bx1 = x1;
  const by1 = y0 + bowlH;
  const holePadX = stemW + inner * 0.06;
  const holePadY = bowlH * 0.22;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block", borderRadius: rounded }}
    >
      <rect x="0" y="0" width="100" height="100" rx={rounded * (100 / size)} fill={bg} />
      <rect x={x0} y={y0} width={stemW} height={inner} fill={fg} />
      <ellipse cx={(x0 + bx1) / 2} cy={(y0 + by1) / 2} rx={(bx1 - x0) / 2} ry={(by1 - y0) / 2} fill={fg} />
      <ellipse
        cx={(x0 + holePadX + bx1 - holePadY) / 2}
        cy={(y0 + holePadY + by1 - holePadY) / 2}
        rx={(bx1 - holePadY - (x0 + holePadX)) / 2}
        ry={(by1 - holePadY - (y0 + holePadY)) / 2}
        fill={bg}
      />
    </svg>
  );
}