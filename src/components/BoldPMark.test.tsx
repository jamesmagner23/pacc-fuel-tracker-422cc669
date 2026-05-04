import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BoldPMark } from "./BoldPMark";

function renderSvg(size: number): { html: string; viewBox: string; width: string; height: string; rect: Record<string, string>; pathD: string } {
  const html = renderToStaticMarkup(<BoldPMark size={size} />);
  const viewBox = html.match(/viewBox="([^"]+)"/)![1];
  const width = html.match(/width="([^"]+)"/)![1];
  const height = html.match(/height="([^"]+)"/)![1];
  const rectStr = html.match(/<rect[^/]*\/>/)![0];
  const rect: Record<string, string> = {};
  for (const m of rectStr.matchAll(/(\w+)="([^"]+)"/g)) rect[m[1]] = m[2];
  const pathD = html.match(/<path[^>]*\sd="([^"]+)"/)![1];
  return { html, viewBox, width, height, rect, pathD };
}

describe("BoldPMark visual regression", () => {
  it.each([16, 24, 28, 32, 48, 64, 128])("renders square at size=%i with 100x100 viewBox", (size) => {
    const s = renderSvg(size);
    expect(s.width).toBe(String(size));
    expect(s.height).toBe(String(size));
    expect(s.viewBox).toBe("0 0 100 100");
  });

  it("background tile fills the full viewBox", () => {
    const { rect } = renderSvg(64);
    expect(rect.x).toBe("0");
    expect(rect.y).toBe("0");
    expect(rect.width).toBe("100");
    expect(rect.height).toBe("100");
  });

  it("P bounding box is centered in the viewBox (horizontal + vertical)", () => {
    const { pathD } = renderSvg(64);
    const outer = pathD.split("Z")[0]!;
    const xs: number[] = [];
    const ys: number[] = [];
    const cmdRe = /([MHVA])\s*([-\d.\s]+?)(?=[A-Za-z]|$)/g;
    let m: RegExpExecArray | null;
    while ((m = cmdRe.exec(outer))) {
      const cmd = m[1];
      const args = m[2].trim().split(/\s+/).map(Number);
      if (cmd === "M") { xs.push(args[0]); ys.push(args[1]); }
      else if (cmd === "H") { xs.push(args[args.length - 1]); }
      else if (cmd === "V") { ys.push(args[args.length - 1]); }
      else if (cmd === "A") {
        // rx ry rot laf sf x y
        const rx = args[0];
        xs.push(args[5]); ys.push(args[6]);
        xs.push(args[5] + rx); // bowl bulges +rx beyond endpoint
      }
    }
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    expect(minX + maxX).toBeCloseTo(100, 1);
    expect(minY + maxY).toBeCloseTo(100, 1);
  });

  it("bowl counter is a perfect circle with mirrored sweeps", () => {
    const { pathD } = renderSvg(64);
    const arcs = [...pathD.matchAll(/a\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+0\s+1\s+0\s+0\s+(-?\d+(?:\.\d+)?)/g)];
    expect(arcs.length).toBe(2);
    for (const a of arcs) {
      expect(Number(a[1])).toBe(Number(a[2]));
      expect(Math.abs(Number(a[3]))).toBeCloseTo(2 * Number(a[1]), 5);
    }
    expect(Number(arcs[0][3])).toBe(-Number(arcs[1][3]));
  });

  it("geometry is independent of size prop", () => {
    expect(renderSvg(24).pathD).toBe(renderSvg(128).pathD);
  });
});
