import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BoldPMark } from "./BoldPMark";

function getSvg(size: number) {
  const { container } = render(<BoldPMark size={size} />);
  const svg = container.querySelector("svg")!;
  return svg;
}

describe("BoldPMark visual regression", () => {
  it.each([16, 24, 28, 32, 48, 64, 128])("renders square at size=%i with 100x100 viewBox", (size) => {
    const svg = getSvg(size);
    expect(svg.getAttribute("width")).toBe(String(size));
    expect(svg.getAttribute("height")).toBe(String(size));
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
  });

  it("background tile fills the full viewBox (no off-center crop)", () => {
    const svg = getSvg(64);
    const rect = svg.querySelector("rect")!;
    expect(rect.getAttribute("x")).toBe("0");
    expect(rect.getAttribute("y")).toBe("0");
    expect(rect.getAttribute("width")).toBe("100");
    expect(rect.getAttribute("height")).toBe("100");
  });

  it("P bounding box is centered in the viewBox (horizontal + vertical)", () => {
    const svg = getSvg(64);
    const path = svg.querySelector("path")!;
    const d = path.getAttribute("d")!;
    // Extract every numeric coord pair from the path.
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    // The path uses absolute coords for: M x y, H x, V y, A rx ry 0 1 1 x y,
    // then the inner counter via relative `a` (skip after first M-segment Z).
    // Pull X and Y extents from the absolute outer subpath only.
    const outer = d.split("Z")[0]!;
    const xs: number[] = [];
    const ys: number[] = [];
    const cmdRe = /([MHVA])\s*([-\d.\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = cmdRe.exec(outer))) {
      const cmd = m[1];
      const args = m[2].trim().split(/\s+/).map(Number);
      if (cmd === "M") { xs.push(args[0]); ys.push(args[1]); }
      else if (cmd === "H") { xs.push(args[args.length - 1]); }
      else if (cmd === "V") { ys.push(args[args.length - 1]); }
      else if (cmd === "A") {
        // rx ry rot laf sf x y
        xs.push(args[5]); ys.push(args[6]);
        // Arc with rx=ry sweeps to ±r from start; account for far edge of bowl.
        const rx = args[0];
        xs.push(args[5] + rx); // arc bulges to the right of endpoint x
      }
    }
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    expect(minX + maxX).toBeCloseTo(100, 1); // horizontally centered
    expect(minY + maxY).toBeCloseTo(100, 1); // vertically centered
  });

  it("bowl counter is a perfect circle (rx === ry, mirrored sweep)", () => {
    const d = getSvg(64).querySelector("path")!.getAttribute("d")!;
    // Inner counter: two relative arcs `a r r 0 1 0 0 ±2r`.
    const arcs = [...d.matchAll(/a\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+0\s+1\s+0\s+0\s+(-?\d+(?:\.\d+)?)/g)];
    expect(arcs.length).toBe(2);
    for (const a of arcs) {
      const [, rx, ry, dy] = a;
      expect(Number(rx)).toBe(Number(ry));            // perfect circle
      expect(Math.abs(Number(dy))).toBeCloseTo(2 * Number(rx), 5); // diameter
    }
    // Sweeps mirror each other (one +2r, one -2r).
    const dys = arcs.map((a) => Number(a[3]));
    expect(dys[0]).toBe(-dys[1]);
  });

  it("scales identically: geometry is independent of size prop", () => {
    const a = getSvg(24).querySelector("path")!.getAttribute("d");
    const b = getSvg(128).querySelector("path")!.getAttribute("d");
    expect(a).toBe(b);
  });
});
