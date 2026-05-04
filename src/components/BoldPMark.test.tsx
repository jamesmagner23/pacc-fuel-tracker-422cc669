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
    // 5x7 grid: row0=4, r1=3, r2=3, r3=4, r4=2, r5=2, r6=2 = 20
    const { circles } = renderSvg(64);
    expect(circles.length).toBe(20);
  });

  it("dots shrink left-to-right (perspective)", () => {
    const { circles } = renderSvg(64);
    const byCol = new Map<number, number>();
    for (const c of circles) {
      const prev = byCol.get(c.cx);
      if (prev !== undefined) expect(c.r).toBeCloseTo(prev, 5);
      byCol.set(c.cx, c.r);
    }
    const cols = [...byCol.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < cols.length; i++) {
      expect(cols[i][1]).toBeLessThan(cols[i - 1][1]);
    }
  });

  it("geometry is independent of size prop", () => {
    const a = renderSvg(24).circles;
    const b = renderSvg(128).circles;
    expect(a).toEqual(b);
  });
});
