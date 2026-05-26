import { useEffect, useState } from "react";

/**
 * Read a CSS custom property at runtime so Recharts (which writes raw SVG
 * attributes) can use the same colour as the rest of the themed UI.
 * Falls back to the dark palette so SSR / first paint still renders.
 */
function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export type ChartPalette = {
  /** Primary brand colour for the dominant series (line / first bar). */
  primary: string;
  /** Supporting series colour used for stacked / secondary metrics. */
  secondary: string;
  /** Tertiary accent for charts with 3 series. */
  tertiary: string;
  positive: string;
  negative: string;
  warning: string;
  text: string;
  textMuted: string;
  grid: string;
  surface: string;
  /** Categorical palette (pies, multi-series) — light/dark tuned. */
  categorical: string[];
};

function buildPalette(): ChartPalette {
  const accent = readVar("--accent", "#C8F26A");
  const primaryVar = readVar("--primary", "#0E1F10");
  const surface = readVar("--surface", "#142A16");
  const surfaceRaised = readVar("--surface-raised", "#1B3520");
  const border = readVar("--surface-border", "#2A4A2E");
  const text = readVar("--text-primary", "#ECE4D2");
  const textMuted = readVar("--text-muted", "#8B8773");
  const positive = readVar("--positive", accent);
  const negative = readVar("--negative", "#FF6B5E");
  const warning = readVar("--warning", "#F5C25B");

  // Light vs dark is determined by the html dataset we set in globalTheme.ts.
  // Default to light because the global theme is light-first.
  const isLight =
    typeof document === "undefined"
      ? true
      : document.documentElement.dataset.theme !== "dark" &&
        !document.documentElement.classList.contains("dark");

  const categorical = isLight
    ? ["#0E1F10", "#3F6B36", "#7A9A6B", "#C8A24A", "#7A5B3A", "#A7B1A4"]
    : ["#C8F26A", "#9BC36A", "#ECE4D2", "#7A9A6B", "#F5C25B", "#C7BFAC"];

  // Primary line/bar = deep green in light mode (readable on white),
  // lime in dark mode. Secondary/tertiary tuned per mode for stacks.
  const primary = isLight ? primaryVar : accent;
  const secondary = isLight ? "#3F6B36" : "#3F6B36";
  const tertiary = isLight ? "#C8A24A" : "#1B3520";

  return {
    primary,
    secondary,
    tertiary,
    positive,
    negative,
    warning,
    text,
    textMuted,
    grid: border,
    surface: surfaceRaised || surface,
    categorical,
  };
}

/**
 * Hook that returns the current chart palette and re-computes when the
 * global theme toggles (`pacc:global-theme` event).
 */
export function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>(() => buildPalette());

  useEffect(() => {
    const recompute = () => setPalette(buildPalette());
    // run once after mount so first SSR paint hydrates with real values
    recompute();
    window.addEventListener("pacc:global-theme", recompute);
    window.addEventListener("storage", recompute);
    return () => {
      window.removeEventListener("pacc:global-theme", recompute);
      window.removeEventListener("storage", recompute);
    };
  }, []);

  return palette;
}