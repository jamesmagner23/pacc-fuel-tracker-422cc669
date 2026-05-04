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
  const tileRadius = bleed ? 0 : (rounded * 100) / size;
  // Geometry — symmetric bold "P" centered in 100x100 viewBox.
  // The mark's bounding box is centered both horizontally and vertically.
  // Bbox: x ∈ [22, 78] (center 50), y ∈ [20, 80] (center 50).
  const stemW = 22;            // stem thickness
  const stemX = 22;            // stem left edge
  const stemTop = 20;
  const stemBottom = 80;
  const bowlOuterR = 22;
  const bowlInnerR = 9;
  // Horizontal: bbox = [stemX, bowlCx + bowlOuterR]; center at 50 → bowlCx = 56.
  const bowlCx = 100 - stemX - bowlOuterR; // 56
  // Vertical: bowl top aligns with stemTop; bbox = [stemTop, stemBottom], center 50.
  const bowlCy = stemTop + bowlOuterR;     // 42

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block", borderRadius: rounded }}
    >
      <rect x="0" y="0" width="100" height="100" rx={tileRadius} fill={bg} />
      <path
        fill={fg}
        fillRule="evenodd"
        d={`
          M ${stemX} ${stemTop}
          H ${bowlCx}
          A ${bowlOuterR} ${bowlOuterR} 0 1 1 ${bowlCx} ${bowlCy + bowlOuterR}
          H ${stemX + stemW}
          V ${stemBottom}
          H ${stemX}
          Z
          M ${bowlCx} ${bowlCy - bowlInnerR}
          a ${bowlInnerR} ${bowlInnerR} 0 1 0 0 ${bowlInnerR * 2}
          a ${bowlInnerR} ${bowlInnerR} 0 1 0 0 ${-bowlInnerR * 2}
          Z
        `}
      />
    </svg>
  );
}