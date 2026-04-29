import { Sun, Moon } from "lucide-react";
import { usePortalTheme } from "@/lib/portalTheme";

type Size = "sm" | "md";

/**
 * Light/dark toggle for the customer + driver portals.
 * Choice persists in localStorage (key: pacc.portal.theme).
 * Inherits CSS variables from the surrounding portal root.
 */
export function PortalThemeToggle({ size = "md" }: { size?: Size }) {
  const { theme, toggle, isDark } = usePortalTheme();
  const dim = size === "sm" ? 32 : 36;
  const icon = size === "sm" ? 14 : 16;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        width: dim,
        height: dim,
        minWidth: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "1px solid var(--surface-border)",
        borderRadius: 999,
        color: "var(--text-secondary)",
        cursor: "pointer",
        transition: "background 120ms ease, color 120ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
      }}
      data-theme={theme}
    >
      {isDark ? <Sun size={icon} /> : <Moon size={icon} />}
    </button>
  );
}