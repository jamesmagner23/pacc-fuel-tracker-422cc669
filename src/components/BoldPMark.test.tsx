import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BoldPMark } from "./BoldPMark";

function renderSvg(size: number) {
  const html = renderToStaticMarkup(<BoldPMark size={size} />);
  const viewBox = html.match(/viewBox="([^"]+)"/)![1];
  const width = html.match(/width="([^"]+)"/)![1];
  const height = html.match(/height="([^"]+)"/)![1];
  const circles = [...html.matchAll(/<circle\s+cx="([\d.]+)"\s+cy="([\d.]+)"\s+r="([\d.]+)"/g)].map(
    (m) => ({ cx: +m[1], cy: +m[2], r: +m[3] }),
  );
  return { html, viewBox, width, height, circles };
}

describe("BoldPMark dot-grid regression", () => {
  it.each([16, 24, 28, 32, 48, 64, 128])("renders square at size=%i with 100x100 viewBox", (size) => {
    const s = renderSvg(size);
    expect(s.width).toBe(String(size));
    expect(s.height).toBe(String(size));
    expect(s.viewBox).toBe("0 0 100 100");
  });

  it("renders the expected number of dots for the P glyph", () => {
    // 5x7 grid: row0=4, r1=2, r2=2, r3=4, r4=1, r5=1, r6=1 = 15
    const { circles } = renderSvg(64);
    expect(circles.length).toBe(15);
  });

  it("dots are uniform in size (symmetric)", () => {
    const { circles } = renderSvg(64);
    const r0 = circles[0].r;
    for (const c of circles) expect(c.r).toBeCloseTo(r0, 5);
  });

  it("geometry is independent of size prop", () => {
    const a = renderSvg(24).circles;
    const b = renderSvg(128).circles;
    expect(a).toEqual(b);
  });
});
