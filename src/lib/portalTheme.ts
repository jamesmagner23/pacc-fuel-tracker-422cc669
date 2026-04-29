import type React from "react";
import { useEffect, useState, useCallback } from "react";

export type PortalTheme = "light" | "dark";

const STORAGE_KEY = "pacc.portal.theme";

// ─── Palettes ────────────────────────────────────────────────────────
// Light = "showcase email" cream/white. Dark = original deep brown portal.
export const LIGHT_TOKENS = {
  bg: "#FAF6EF",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceHover: "#F7F1E4",
  border: "#EDE3D2",
  borderSubtle: "#F1E8D8",
  accent: "#E8461E",
  accentHover: "#D13A14",
  accentLight: "rgba(232,70,30,0.10)",
  text: "#3D2B1A",
  textSecondary: "#6B5240",
  textMuted: "#8B7355",
  positive: "#0F8A5E",
  positiveBg: "rgba(15,138,94,0.10)",
  negative: "#B91C1C",
  negativeBg: "rgba(185,28,28,0.08)",
  warning: "#B45309",
  warningBg: "rgba(180,83,9,0.10)",
  secondary: "#F7F1E4",
  mapBg: "#F7F1E4",
  // Pie palette tuned for cream/white
  pie: ["#E8461E", "#3D2B1A", "#D88B5C", "#6B5240", "#F59E0B", "#8B7355"],
  badgePending: "#8B7355",
  badgeConfirmed: "#E8461E",
  badgeCompleted: "#0F8A5E",
} as const;

export const DARK_TOKENS = {
  bg: "#120a04",
  surface: "#1e1008",
  surfaceRaised: "#27160c",
  surfaceHover: "#2a1810",
  border: "#3a2418",
  borderSubtle: "#2a1a10",
  accent: "#f04a1a",
  accentHover: "#ff5a2a",
  accentLight: "rgba(240,74,26,0.18)",
  text: "#FAF6EF",
  textSecondary: "#D5C3AE",
  textMuted: "#9C8770",
  positive: "#22C55E",
  positiveBg: "rgba(34,197,94,0.15)",
  negative: "#EF4444",
  negativeBg: "rgba(239,68,68,0.15)",
  warning: "#F59E0B",
  warningBg: "rgba(245,158,11,0.15)",
  secondary: "#27160c",
  mapBg: "#1e1008",
  // Pie palette tuned for dark backgrounds
  pie: ["#f04a1a", "#FAF6EF", "#F59E0B", "#D88B5C", "#FDBA74", "#A78A6F"],
  badgePending: "#9C8770",
  badgeConfirmed: "#f04a1a",
  badgeCompleted: "#22C55E",
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