import { createContext, useContext, useMemo, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DemoGate } from "@/components/DemoGate";

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

const DEMO_DEFAULT_BRAND = "FuelTrack";
const DEMO_DEFAULT_COLOR = "blue";

function resolveColor(color: string | null): string | null {
  if (!color) return null;
  const lower = color.toLowerCase();
  if (COLOR_PRESETS[lower]) return COLOR_PRESETS[lower];
  if (lower.startsWith("#") && (lower.length === 4 || lower.length === 7)) {
    return null;
  }
  return null;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "true";
  const brand = isDemo ? (params.get("brand") || DEMO_DEFAULT_BRAND) : null;
  const rawColor = isDemo ? (params.get("color") || DEMO_DEFAULT_COLOR) : null;

  const [unlocked, setUnlocked] = useState(() =>
    sessionStorage.getItem("demo_unlocked") === "true"
  );

  const accentColor = useMemo(() => resolveColor(rawColor), [rawColor]);
  const hexColor = useMemo(() => {
    if (!rawColor) return null;
    const lower = rawColor.toLowerCase();
    if (lower.startsWith("#")) return lower;
    return null;
  }, [rawColor]);

  // Apply neutral theme + accent color in demo mode
  useEffect(() => {
    if (!isDemo) return;
    const root = document.documentElement;

    // Override backgrounds to neutral slate (not PACC brown)
    root.style.setProperty("--background", "#1a1f2e");
    root.style.setProperty("--surface", "#232838");
    root.style.setProperty("--surface-raised", "#2b3145");
    root.style.setProperty("--surface-border", "#3d4459");
    root.style.setProperty("--border", "#3d4459");
    root.style.setProperty("--text-primary", "#e8eaf0");
    root.style.setProperty("--text-secondary", "#9ca3b8");
    root.style.setProperty("--text-muted", "#6b7280");

    if (accentColor) {
      root.style.setProperty("--primary", accentColor);
      root.style.setProperty("--accent", `hsl(${accentColor})`);
      root.style.setProperty("--accent-hover", `hsl(${accentColor})`);
      root.style.setProperty("--accent-light", `hsla(${accentColor} / 0.15)`);
      root.style.setProperty("--accent-text", `hsl(${accentColor})`);
      root.style.setProperty("--demo-accent", `hsl(${accentColor})`);
    } else if (hexColor) {
      root.style.setProperty("--demo-accent", hexColor);
    }

    return () => {
      root.style.removeProperty("--background");
      root.style.removeProperty("--surface");
      root.style.removeProperty("--surface-raised");
      root.style.removeProperty("--surface-border");
      root.style.removeProperty("--border");
      root.style.removeProperty("--text-primary");
      root.style.removeProperty("--text-secondary");
      root.style.removeProperty("--text-muted");
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-hover");
      root.style.removeProperty("--accent-light");
      root.style.removeProperty("--accent-text");
      root.style.removeProperty("--demo-accent");
    };
  }, [isDemo, accentColor, hexColor]);

  const value = useMemo(
    () => ({ isDemo, brand, accentColor: accentColor || hexColor }),
    [isDemo, brand, accentColor, hexColor]
  );

  // Show gate if demo mode is active but not yet unlocked
  if (isDemo && !unlocked) {
    return (
      <DemoContext.Provider value={value}>
        <DemoGate
          brand={brand}
          color={rawColor}
          onUnlock={() => setUnlocked(true)}
        />
      </DemoContext.Provider>
    );
  }

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
