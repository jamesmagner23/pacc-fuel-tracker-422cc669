import { createContext, useContext, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

interface DemoContextValue {
  isDemo: boolean;
  brand: string | null;
  accentColor: string | null;
}

const DemoContext = createContext<DemoContextValue>({ isDemo: false, brand: null, accentColor: null });

/** Map friendly color names to HSL values */
const COLOR_PRESETS: Record<string, string> = {
  blue: "217 91% 50%",
  red: "0 84% 50%",
  green: "142 71% 40%",
  purple: "270 60% 50%",
  teal: "175 70% 38%",
  orange: "18 95% 54%",
  pink: "330 70% 55%",
  yellow: "45 93% 47%",
  indigo: "240 60% 55%",
  cyan: "190 80% 45%",
};

function resolveColor(color: string | null): string | null {
  if (!color) return null;
  const lower = color.toLowerCase();
  if (COLOR_PRESETS[lower]) return COLOR_PRESETS[lower];
  // Accept raw hex — convert to HSL-ish for CSS var
  if (lower.startsWith("#") && (lower.length === 4 || lower.length === 7)) {
    return null; // fallback: apply hex directly
  }
  return null;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "true";
  const brand = params.get("brand") || null;
  const rawColor = params.get("color") || null;

  const accentColor = useMemo(() => resolveColor(rawColor), [rawColor]);
  const hexColor = useMemo(() => {
    if (!rawColor) return null;
    const lower = rawColor.toLowerCase();
    if (lower.startsWith("#")) return lower;
    return null;
  }, [rawColor]);

  // Apply accent color as CSS custom properties on :root
  useEffect(() => {
    if (!isDemo) return;
    const root = document.documentElement;

    if (accentColor) {
      root.style.setProperty("--primary", accentColor);
      root.style.setProperty("--accent", accentColor);
      // Also set a CSS variable for inline style usage
      root.style.setProperty("--demo-accent", `hsl(${accentColor})`);
      return () => {
        root.style.removeProperty("--primary");
        root.style.removeProperty("--accent");
        root.style.removeProperty("--demo-accent");
      };
    } else if (hexColor) {
      root.style.setProperty("--demo-accent", hexColor);
      return () => {
        root.style.removeProperty("--demo-accent");
      };
    }
  }, [isDemo, accentColor, hexColor]);

  const value = useMemo(
    () => ({ isDemo, brand, accentColor: accentColor || hexColor }),
    [isDemo, brand, accentColor, hexColor]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** Returns true if in demo mode (backward compatible) */
export function useDemo(): boolean {
  return useContext(DemoContext).isDemo;
}

/** Returns full demo context including white-label params */
export function useDemoContext() {
  return useContext(DemoContext);
}
