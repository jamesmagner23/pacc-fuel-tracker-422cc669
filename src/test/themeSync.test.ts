/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyGlobalTheme,
  CSS_VAR_MAP,
  GLOBAL_DARK,
  GLOBAL_LIGHT,
  tokensForGlobal,
} from "@/lib/globalTheme";

function n(v: string): string {
  return v.trim().toLowerCase();
}

describe("Global theme: dark", () => {
  beforeEach(() => applyGlobalTheme("dark"));

  it("sets every CSS variable from CSS_VAR_MAP on <html>", () => {
    const root = document.documentElement;
    for (const [cssVar, key] of Object.entries(CSS_VAR_MAP)) {
      expect(n(root.style.getPropertyValue(cssVar))).toBe(n(GLOBAL_DARK[key]));
    }
  });

  it("syncs <meta name='theme-color'> to background", () => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    expect(meta).toBeTruthy();
    expect(n(meta.content)).toBe(n(GLOBAL_DARK.background));
  });

  it("matches the dark palette declared in src/index.css", () => {
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    const expectations: Array<[string, string]> = [
      ["--background", GLOBAL_DARK.background],
      ["--accent", GLOBAL_DARK.accent],
      ["--text-primary", GLOBAL_DARK.textPrimary],
      ["--positive", GLOBAL_DARK.positive],
      ["--negative", GLOBAL_DARK.negative],
      ["--warning", GLOBAL_DARK.warning],
    ];
    for (const [token, expected] of expectations) {
      const m = css.match(new RegExp(`${token}\\s*:\\s*([^;\\s]+)`));
      expect(m, `${token} missing in index.css`).toBeTruthy();
      expect(n(m![1])).toBe(n(expected));
    }
  });

  it("matches the manifest theme + background colors", () => {
    const mf = JSON.parse(readFileSync(join(process.cwd(), "public/manifest.json"), "utf8"));
    expect(n(mf.theme_color)).toBe(n(GLOBAL_DARK.background));
    expect(n(mf.background_color)).toBe(n(GLOBAL_DARK.background));
  });
});

describe("Global theme: light", () => {
  beforeEach(() => applyGlobalTheme("light"));

  it("rewrites every CSS variable to the light palette", () => {
    const root = document.documentElement;
    for (const [cssVar, key] of Object.entries(CSS_VAR_MAP)) {
      expect(n(root.style.getPropertyValue(cssVar))).toBe(n(GLOBAL_LIGHT[key]));
    }
  });

  it("re-points <meta theme-color> to the light background", () => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    expect(n(meta.content)).toBe(n(GLOBAL_LIGHT.background));
  });
});

describe("Global theme: parity", () => {
  it("dark and light expose identical token keys", () => {
    expect(Object.keys(GLOBAL_DARK).sort()).toEqual(Object.keys(GLOBAL_LIGHT).sort());
  });
  it("tokensForGlobal returns the right table", () => {
    expect(tokensForGlobal("dark")).toBe(GLOBAL_DARK);
    expect(tokensForGlobal("light")).toBe(GLOBAL_LIGHT);
  });
});