import { Moon, Sun } from "lucide-react";
import { useGlobalTheme } from "@/lib/globalTheme";

export function GlobalThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useGlobalTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-surface-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-foreground transition-colors"
      style={{
        padding: compact ? "6px 8px" : "8px 12px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
        background: "var(--surface)",
        border: "1px solid var(--surface-border)",
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
      {!compact && <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}