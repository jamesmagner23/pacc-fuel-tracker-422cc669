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
    root.style.setProperty("--surface-hover", "#323850");
    root.style.setProperty("--border", "#3d4459");
    root.style.setProperty("--border-subtle", "#2b3145");
    root.style.setProperty("--text-primary", "#e8eaf0");
    root.style.setProperty("--text-secondary", "#9ca3b8");
    root.style.setProperty("--text-muted", "#6b7280");
    root.style.setProperty("--map-bg", "#141825");
    root.style.setProperty("--map-border", "#232838");

    // Override shadcn compat
    root.style.setProperty("--foreground", "#e8eaf0");
    root.style.setProperty("--card", "#232838");
    root.style.setProperty("--card-foreground", "#e8eaf0");
    root.style.setProperty("--popover", "#2b3145");
    root.style.setProperty("--popover-foreground", "#e8eaf0");
    root.style.setProperty("--secondary", "#2b3145");
    root.style.setProperty("--secondary-foreground", "#e8eaf0");
    root.style.setProperty("--muted", "#3d4459");
    root.style.setProperty("--muted-foreground", "#9ca3b8");
    root.style.setProperty("--input", "#3d4459");

    const resolvedAccent = accentColor || "217 91% 50%";
    root.style.setProperty("--accent", `hsl(${resolvedAccent})`);
    root.style.setProperty("--accent-hover", `hsl(${resolvedAccent})`);
    root.style.setProperty("--accent-light", `hsla(${resolvedAccent} / 0.15)`);
    root.style.setProperty("--accent-text", `hsl(${resolvedAccent})`);
    root.style.setProperty("--primary", resolvedAccent);
    root.style.setProperty("--ring", `hsl(${resolvedAccent})`);
    root.style.setProperty("--demo-accent", `hsl(${resolvedAccent})`);

    return () => {
      const props = [
        "--background", "--surface", "--surface-raised", "--surface-border", "--surface-hover",
        "--border", "--border-subtle", "--text-primary", "--text-secondary", "--text-muted",
        "--map-bg", "--map-border",
        "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground",
        "--secondary", "--secondary-foreground", "--muted", "--muted-foreground", "--input",
        "--accent", "--accent-hover", "--accent-light", "--accent-text",
        "--primary", "--ring", "--demo-accent",
      ];
      props.forEach(p => root.style.removeProperty(p));
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
