import { useEffect, useState, useCallback } from "react";

export type GlobalTheme = "dark" | "light";

const STORAGE_KEY = "pacc.global.theme";
const META_NAME = "theme-color";

// Mirror of the dark palette declared in src/index.css.
// Keep in sync with that file (the branding test enforces parity).
type Tokens = {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceBorder: string;
  surfaceHover: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  positive: string;
  positiveBg: string;
  negative: string;
  negativeBg: string;
  warning: string;
  warningBg: string;
  border: string;
  borderSubtle: string;
  primaryForeground: string;
  destructive: string;
  destructiveForeground: string;
};

export const GLOBAL_DARK: Tokens = {
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
};

// Light palette derived from the brand cream/dark-green system.
export const GLOBAL_LIGHT: Tokens = {
  // Breadcrumb-inspired: white ground, deep-green type/primary, lime accent.
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceRaised: "#F4F5F1",
  surfaceBorder: "#E5E7E0",
  surfaceHover: "#FAFBF7",
  accent: "#C8F26A",
  accentHover: "#B6E254",
  accentLight: "rgba(200,242,106,0.18)",
  textPrimary: "#0E1F10",
  textSecondary: "#5F6B61",
  textMuted: "#8A9085",
  positive: "#2A6A2E",
  positiveBg: "#E6F3E1",
  negative: "#B43A2E",
  negativeBg: "#FBE5E2",
  warning: "#7A5300",
  warningBg: "#FFF4D9",
  border: "#E5E7E0",
  borderSubtle: "#EEF0EA",
  primaryForeground: "#FFFFFF",
  destructive: "#B43A2E",
  destructiveForeground: "#FFFFFF",
};

export function tokensForGlobal(theme: GlobalTheme) {
  return theme === "light" ? GLOBAL_LIGHT : GLOBAL_DARK;
}

/** Mapping from CSS variable name → token key (single source of truth). */
export const CSS_VAR_MAP: Record<string, keyof Tokens> = {
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
  "--ring": "textPrimary",
  "--input": "surfaceBorder",
};

// In light mode, --primary should be the deep-green type colour, not lime.
// We override after the generic map application.
function applyLightOverrides(root: HTMLElement, tk: Tokens) {
  root.style.setProperty("--primary", tk.textPrimary);
  root.style.setProperty("--primary-foreground", "#FFFFFF");
  root.style.setProperty("--card", "#FFFFFF");
  root.style.setProperty("--popover", "#FFFFFF");
  root.style.setProperty("--secondary", "#F4F5F1");
  root.style.setProperty("--muted", "#F4F5F1");
  root.style.setProperty("--muted-foreground", tk.textSecondary);
  root.style.setProperty("--ring", tk.textPrimary);
}

/** Apply theme to <html> and update <meta name="theme-color">. */
export function applyGlobalTheme(theme: GlobalTheme): void {
  if (typeof document === "undefined") return;
  const tk = tokensForGlobal(theme);
  const root = document.documentElement;
  for (const [cssVar, tokenKey] of Object.entries(CSS_VAR_MAP)) {
    root.style.setProperty(cssVar, tk[tokenKey]);
  }
  if (theme === "light") {
    applyLightOverrides(root, tk);
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
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
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
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