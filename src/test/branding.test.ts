import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const EXPECTED = {
  themeColor: "#0E1F10",
  background: "#0E1F10",
  accent: "#C8F26A",
  textPrimary: "#ECE4D2",
  positive: "#C8F26A",
  negative: "#FF6B5E",
  warning: "#F5C25B",
};

const BRAND_HEX = new Set(
  [
    "#0E1F10",
    "#142A16",
    "#1B3520",
    "#2A4A2E",
    "#1F3A24",
    "#3F6B36",
    "#C8F26A",
    "#B6E254",
    "#ECE4D2",
    "#C7BFAC",
    "#8B8773",
    "#FF6B5E",
    "#F5C25B",
    "#EDE3D2",
    "#EFE9DC",
    "#F1E8D8",
    "#FFFFFF",
    "#000000",
  ].map((h) => h.toLowerCase())
);

function read(p: string): string {
  return readFileSync(join(ROOT, p), "utf8");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const stat = statSync(join(ROOT, rel));
    if (stat.isDirectory()) walk(rel, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(rel);
  }
  return out;
}

describe("Brand: meta + manifest", () => {
  const html = read("index.html");
  const manifest = JSON.parse(read("public/manifest.json"));

  it("index.html has theme-color matching forest green", () => {
    expect(html).toMatch(new RegExp(`name="theme-color"\\s+content="${EXPECTED.themeColor}"`, "i"));
  });
  it("index.html references favicon, apple-touch-icon, mask-icon", () => {
    expect(html).toMatch(/rel="icon"/);
    expect(html).toMatch(/rel="apple-touch-icon"/);
    expect(html).toMatch(/rel="mask-icon"/);
  });
  it("index.html has og:image", () => {
    expect(html).toMatch(/property="og:image"[^>]+content="[^"]*og-image\.jpg"/);
  });
  it("manifest theme_color and background_color match brand", () => {
    expect(manifest.theme_color.toLowerCase()).toBe(EXPECTED.themeColor.toLowerCase());
    expect(manifest.background_color.toLowerCase()).toBe(EXPECTED.background.toLowerCase());
  });
  it("manifest declares 192 + 512 icons", () => {
    const sizes = (manifest.icons as any[]).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });
});

describe("Brand: design tokens", () => {
  const css = read("src/index.css");
  it.each([
    ["--background", EXPECTED.background],
    ["--accent", EXPECTED.accent],
    ["--text-primary", EXPECTED.textPrimary],
    ["--positive", EXPECTED.positive],
    ["--negative", EXPECTED.negative],
    ["--warning", EXPECTED.warning],
  ])("%s = %s", (token, expected) => {
    const re = new RegExp(`${token}\\s*:\\s*([^;\\s]+)`);
    const m = css.match(re);
    expect(m).toBeTruthy();
    expect(m![1].toLowerCase()).toBe(expected.toLowerCase());
  });
});

describe("Brand: chart colors stay on palette", () => {
  const chartFiles = [
    "src/pages/Trucks.tsx",
    "src/pages/Drivers.tsx",
    "src/pages/CustomerHub.tsx",
    "src/pages/CustomerDetail.tsx",
    "src/pages/Overview.tsx",
    "src/pages/MarketIntelligence.tsx",
    "src/components/admin/EBITDATab.tsx",
    "src/components/admin/AdminOverview.tsx",
    "src/components/finance/PLOverview.tsx",
    "src/components/finance/BuyPriceTab.tsx",
    "src/components/finance/ClientPricingTab.tsx",
    "src/components/dispatch/DispatchAnalytics.tsx",
  ];

  it.each(chartFiles)("%s only uses palette hex codes", (path) => {
    const src = read(path);
    const hexes = src.match(/#[0-9A-Fa-f]{6}\b/g) || [];
    const offBrand = hexes.filter((h) => !BRAND_HEX.has(h.toLowerCase()));
    expect(offBrand, `Off-brand colors found: ${[...new Set(offBrand)].join(", ")}`).toEqual([]);
  });
});

describe("Brand: shared UI primitives use semantic tokens", () => {
  const uiFiles = walk("src/components/ui");
  const FORBIDDEN = /(?:focus|hover|active|focus-visible)[^\s"'`]*:(?:ring|bg|text|border)-(white|black|gray|slate|zinc|neutral|stone|red|blue|green|yellow|orange|indigo|purple|pink|emerald|amber|sky|teal|cyan|rose|lime|violet|fuchsia)-/;
  it.each(uiFiles)("%s avoids raw Tailwind palette in interactive states", (path) => {
    const src = read(path);
    const matches = src.match(new RegExp(FORBIDDEN.source, "g")) || [];
    expect(matches, `Found: ${matches.join(", ")}`).toEqual([]);
  });
});