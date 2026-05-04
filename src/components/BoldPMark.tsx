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
  // Bold, solid "P" rendered as a single filled path so the bowl reads
  // clearly at any size. ViewBox is 100x100.
  const tileRadius = bleed ? 0 : (rounded * 100) / size;
  // Path coords: outer P (stem + rounded bowl) minus inner counter (hole).
  // Uses even-odd fill so the inner subpath cuts a clean hole.
  const d = [
    // Outer shape
    "M 18 14",
    "H 60",
    "A 22 22 0 0 1 60 58",
    "H 38",
    "V 86",
    "H 18",
    "Z",
    // Inner counter (hole in the bowl)
    "M 38 30",
    "H 58",
    "A 8 8 0 0 1 58 46",
    "H 38",
    "Z",
  ].join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block", borderRadius: rounded }}
    >
      <rect x="0" y="0" width="100" height="100" rx={tileRadius} fill={bg} />
      <path d={d} fill={fg} fillRule="evenodd" />
    </svg>
  );
}