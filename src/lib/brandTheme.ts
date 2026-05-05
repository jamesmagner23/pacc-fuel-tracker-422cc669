/**
 * Customer branding helpers.
 *
 * Rule: only the **accent** family is allowed to flex per customer.
 * Background, surface, text and semantic status colors stay locked so
 * charts, status badges, and body text stay readable.
 *
 * Every accent we expose is contrast-checked against the surface it is
 * most likely to render on. If it fails WCAG AA (4.5:1 small / 3:1 large)
 * we nudge the lightness until it passes.
 */

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) {
    const short = /^#?([a-f\d]{3})$/i.exec(hex.trim());
    if (!short) return null;
    const r = parseInt(short[1][0] + short[1][0], 16);
    const g = parseInt(short[1][1] + short[1][1], 16);
    const b = parseInt(short[1][2] + short[1][2], 16);
    return [r, g, b];
  }
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [hue(h + 1/3) * 255, hue(h) * 255, hue(h - 1/3) * 255];
}

function relLum(r: number, g: number, b: number): number {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  if (!a || !b) return 1;
  const la = relLum(...a), lb = relLum(...b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Returns whichever of black/white reads best on top of the given background.
 */
export function bestForeground(bgHex: string): "#000000" | "#FFFFFF" {
  return contrastRatio(bgHex, "#FFFFFF") >= contrastRatio(bgHex, "#000000")
    ? "#FFFFFF"
    : "#000000";
}

/**
 * Walk lightness up/down until the color hits the target contrast ratio
 * against `surfaceHex`. Returns the original color if it can't be made to fit
 * (very rare — pure mid-grey on mid-grey).
 */
export function ensureContrast(
  hex: string,
  surfaceHex: string,
  target = 4.5,
): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (contrastRatio(hex, surfaceHex) >= target) return hex;

  const [h, s, lOriginal] = rgbToHsl(...rgb);
  // Darken if surface is light; lighten if surface is dark.
  const surfaceRgb = hexToRgb(surfaceHex);
  const surfaceLum = surfaceRgb ? relLum(...surfaceRgb) : 1;
  const direction = surfaceLum > 0.5 ? -1 : 1; // -1 = darken

  for (let step = 1; step <= 50; step++) {
    const l = clamp(lOriginal + direction * step, 4, 96);
    const candidate = rgbToHex(...hslToRgb(h, s, l));
    if (contrastRatio(candidate, surfaceHex) >= target) return candidate;
    if (l <= 4 || l >= 96) break;
  }
  return hex;
}

/** Lighten a color toward 90% L (used for accent-light backgrounds). */
export function tint(hex: string, lightness = 92): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s] = rgbToHsl(...rgb);
  return rgbToHex(...hslToRgb(h, s, lightness));
}

export function isValidHex(value: string | null | undefined): value is string {
  if (!value) return false;
  return !!hexToRgb(value);
}

/**
 * Build the override CSS variables for a customer brand accent.
 * Only `--accent*` and `--ring` flex; everything else stays from the
 * portal's existing light/dark tokens.
 */
export function brandAccentVars(
  accentHex: string,
  surfaceHex: string,
): React.CSSProperties {
  const safeAccent = ensureContrast(accentHex, surfaceHex, 4.5);
  const fg = bestForeground(safeAccent);
  const light = tint(safeAccent, 92);
  return {
    ["--accent" as any]: safeAccent,
    ["--accent-hover" as any]: ensureContrast(safeAccent, surfaceHex, 4.5),
    ["--accent-light" as any]: light,
    ["--accent-text" as any]: safeAccent,
    ["--primary" as any]: safeAccent,
    ["--primary-foreground" as any]: fg,
    ["--ring" as any]: safeAccent,
  };
}

import type React from "react";