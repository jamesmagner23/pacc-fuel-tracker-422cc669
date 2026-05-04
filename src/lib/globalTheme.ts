import { useEffect, useState, useCallback } from "react";

export type GlobalTheme = "dark" | "light";

const STORAGE_KEY = "pacc.global.theme";
const META_NAME = "theme-color";

// Mirror of the dark palette declared in src/index.css.
// Keep in sync with that file (the branding test enforces parity).
export const GLOBAL_DARK = {
  background: "#0E1F10",
  surface: "#142A16",
  surfaceRaised: "#1B3520",
  surfaceBorder: "#2A4A2E",
  surfaceHover: "#1F3A24",
  accent: "#C8F26A",
  accentHover: "#B6E254",
  accentLight: "rgba(200,242,106,0.14)",
  textPrimary: "#ECE4D2",
  textSecondary: "#C7BFAC",
  textMuted: "#8B8773",
  positive: "#C8F26A",
  positiveBg: "rgba(200,242,106,0.14)",
  negative: "#FF6B5E",
  negativeBg: "rgba(255,107,94,0.14)",
  warning: "#F5C25B",
  warningBg: "rgba(245,194,91,0.14)",
  border: "#2A4A2E",
  borderSubtle: "#1F3A24",
  primaryForeground: "#0E1F10",
  destructive: "#FF6B5E",
  destructiveForeground: "#ffffff",
} as const;

// Light palette derived from the brand cream/dark-green system.
export const GLOBAL_LIGHT: typeof GLOBAL_DARK = {
  background: "#EFE9DC",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceBorder: "#D9D2BF",
  surfaceHover: "#F4EEDF",
  accent: "#3F6B36",
  accentHover: "#345A2C",
  accentLight: "rgba(63,107,54,0.10)",
  textPrimary: "#0E1F10",
  textSecondary: "#3F4A3A",
  textMuted: "#6B7565",
  positive: "#3F6B36",
  positiveBg: "rgba(63,107,54,0.10)",
  negative: "#A82E1E",
  negativeBg: "rgba(168,46,30,0.08)",
  warning: "#B45309",
  warningBg: "rgba(180,83,9,0.10)",
  border: "#D9D2BF",
  borderSubtle: "#E4DDC9",
  primaryForeground: "#FFFFFF",
  destructive: "#A82E1E",
  destructiveForeground: "#FFFFFF",
};

export function tokensForGlobal(theme: GlobalTheme) {
  return theme === "light" ? GLOBAL_LIGHT : GLOBAL_DARK;
}

/** Mapping from CSS variable name → token key (single source of truth). */
export const CSS_VAR_MAP: Record<string, keyof typeof GLOBAL_DARK> = {
  "--background": "background",
  "--surface": "surface",
  "--surface-raised": "surfaceRaised",
  "--surface-border": "surfaceBorder",
  "--surface-hover": "surfaceHover",
  "--accent": "accent",
  "--accent-hover": "accentHover",
  "--accent-light": "accentLight",
  "--accent-text": "accent",
  "--text-primary": "textPrimary",
  "--text-secondary": "textSecondary",
  "--text-muted": "textMuted",
  "--positive": "positive",
  "--positive-bg": "positiveBg",
  "--negative": "negative",
  "--negative-bg": "negativeBg",
  "--warning": "warning",
  "--warning-bg": "warningBg",
  "--border": "border",
  "--border-subtle": "borderSubtle",
  "--foreground": "textPrimary",
  "--primary": "accent",
  "--primary-foreground": "primaryForeground",
  "--card": "surface",
  "--card-foreground": "textPrimary",
  "--popover": "surfaceRaised",
  "--popover-foreground": "textPrimary",
  "--secondary": "surfaceRaised",
  "--secondary-foreground": "textPrimary",
  "--muted": "surfaceBorder",
  "--muted-foreground": "textSecondary",
  "--destructive": "destructive",
  "--destructive-foreground": "destructiveForeground",
  "--ring": "accent",
  "--input": "surfaceBorder",
};

/** Apply theme to <html> and update <meta name="theme-color">. */
export function applyGlobalTheme(theme: GlobalTheme): void {
  if (typeof document === "undefined") return;
  const tk = tokensForGlobal(theme);
  const root = document.documentElement;
  for (const [cssVar, tokenKey] of Object.entries(CSS_VAR_MAP)) {
    root.style.setProperty(cssVar, tk[tokenKey]);
  }
  root.dataset.theme = theme;
  let meta = document.querySelector(`meta[name="${META_NAME}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = META_NAME;
    document.head.appendChild(meta);
  }
  meta.content = tk.background;
}

function readStored(): GlobalTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useGlobalTheme() {
  const [theme, setThemeState] = useState<GlobalTheme>(() => readStored());

  useEffect(() => {
    applyGlobalTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(readStored());
    };
    const onCustom = () => setThemeState(readStored());
    window.addEventListener("storage", onStorage);
    window.addEventListener("pacc:global-theme", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pacc:global-theme", onCustom);
    };
  }, []);

  const setTheme = useCallback((next: GlobalTheme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setThemeState(next);
    window.dispatchEvent(new CustomEvent("pacc:global-theme"));
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle, isDark: theme === "dark", tokens: tokensForGlobal(theme) };
}