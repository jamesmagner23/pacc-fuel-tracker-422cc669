import type React from "react";
import { useEffect, useState, useCallback } from "react";

export type PortalTheme = "light" | "dark";

const STORAGE_KEY = "pacc.portal.theme";

// ─── Palettes ────────────────────────────────────────────────────────
// Light = "showcase email" cream/white. Dark = original deep brown portal.
export const LIGHT_TOKENS = {
  // PACC light = warm bone/cream (from brand doc backdrop)
  bg: "#EFE9DC",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceHover: "#F4EEDF",
  border: "#D9D2BF",
  borderSubtle: "#E4DDC9",
  // Light portal accent: deep sage green (matches chart leads + admin
  // primary). Lime is reserved for dark mode where it pops; on cream it
  // washes out and fails contrast on text/buttons.
  accent: "#3F6B36",
  accentHover: "#2F5128",
  accentLight: "rgba(63,107,54,0.12)",
  text: "#0E1F10",
  textSecondary: "#3F4A3A",
  textMuted: "#6B7565",
  positive: "#3F6B36",
  positiveBg: "rgba(63,107,54,0.10)",
  negative: "#A82E1E",
  negativeBg: "rgba(168,46,30,0.08)",
  warning: "#B45309",
  warningBg: "rgba(180,83,9,0.10)",
  secondary: "#F4EEDF",
  mapBg: "#F4EEDF",
  // Pie palette tuned for cream
  // Harmonious sage/olive tonal palette with one warm accent
  // Light-theme pie palette intentionally omits the lime UI accent —
  // lime is reserved for buttons. Charts lead with darker greens for
  // readability on cream backgrounds.
  pie: ["#3F6B36", "#5C8A4E", "#A7C77A", "#7A9A8B", "#D8B36A", "#C28A5A"],
  badgePending: "#6B7565",
  badgeConfirmed: "#3F6B36",
  badgeCompleted: "#0E1F10",
} as const;

export const DARK_TOKENS = {
  // PACC dark = deep forest green
  bg: "#0E1F10",
  surface: "#142A16",
  surfaceRaised: "#1B3520",
  surfaceHover: "#1F3A24",
  border: "#2A4A2E",
  borderSubtle: "#1F3A24",
  accent: "#C8F26A",
  accentHover: "#B6E254",
  accentLight: "rgba(200,242,106,0.18)",
  text: "#ECE4D2",
  textSecondary: "#C7BFAC",
  textMuted: "#8B8773",
  positive: "#C8F26A",
  positiveBg: "rgba(200,242,106,0.15)",
  negative: "#FF6B5E",
  negativeBg: "rgba(255,107,94,0.15)",
  warning: "#F5C25B",
  warningBg: "rgba(245,194,91,0.15)",
  secondary: "#1B3520",
  mapBg: "#0A1A0C",
  pie: ["#C8F26A", "#9BC36A", "#ECE4D2", "#7A9A6B", "#F5C25B", "#C7BFAC"],
  badgePending: "#8B8773",
  badgeConfirmed: "#C8F26A",
  badgeCompleted: "#C8F26A",
} as const;

export type PortalTokens = typeof LIGHT_TOKENS;

export function tokensFor(theme: PortalTheme): PortalTokens {
  return theme === "dark" ? (DARK_TOKENS as unknown as PortalTokens) : LIGHT_TOKENS;
}

/**
 * CSS-variable bag applied to the portal root so any descendant component
 * (Tailwind tokens, shadcn primitives, var(--*) consumers) re-skins
 * automatically without leaking into the admin app.
 */
export function themeVarsFor(theme: PortalTheme): React.CSSProperties {
  const t = tokensFor(theme);
  return {
    ["--background" as any]: t.bg,
    ["--surface" as any]: t.surface,
    ["--surface-raised" as any]: t.surfaceRaised,
    ["--surface-border" as any]: t.border,
    ["--surface-hover" as any]: t.surfaceHover,
    ["--accent" as any]: t.accent,
    ["--accent-hover" as any]: t.accentHover,
    ["--accent-light" as any]: t.accentLight,
    ["--accent-text" as any]: t.accent,
    ["--text-primary" as any]: t.text,
    ["--text-secondary" as any]: t.textSecondary,
    ["--text-muted" as any]: t.textMuted,
    ["--positive" as any]: t.positive,
    ["--positive-bg" as any]: t.positiveBg,
    ["--negative" as any]: t.negative,
    ["--negative-bg" as any]: t.negativeBg,
    ["--warning" as any]: t.warning,
    ["--warning-bg" as any]: t.warningBg,
    ["--border" as any]: t.border,
    ["--border-subtle" as any]: t.borderSubtle,
    ["--foreground" as any]: t.text,
    ["--card" as any]: t.surface,
    ["--card-foreground" as any]: t.text,
    ["--popover" as any]: t.surface,
    ["--popover-foreground" as any]: t.text,
    ["--secondary" as any]: t.secondary,
    ["--secondary-foreground" as any]: t.text,
    ["--muted" as any]: t.secondary,
    ["--muted-foreground" as any]: t.textSecondary,
    ["--input" as any]: t.border,
    ["--ring" as any]: t.accent,
    ["--map-bg" as any]: t.mapBg,
    ["--map-border" as any]: t.border,
  };
}

function readStored(): PortalTheme {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Portal-scoped theme hook. Persists choice in localStorage and broadcasts
 * across tabs / components in the same tab via a custom event.
 */
export function usePortalTheme() {
  const [theme, setThemeState] = useState<PortalTheme>(() => readStored());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(readStored());
    };
    const onCustom = () => setThemeState(readStored());
    window.addEventListener("storage", onStorage);
    window.addEventListener("pacc:portal-theme", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pacc:portal-theme", onCustom);
    };
  }, []);

  const setTheme = useCallback((next: PortalTheme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setThemeState(next);
    window.dispatchEvent(new CustomEvent("pacc:portal-theme"));
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggle,
    tokens: tokensFor(theme),
    vars: themeVarsFor(theme),
    isDark: theme === "dark",
  };
}