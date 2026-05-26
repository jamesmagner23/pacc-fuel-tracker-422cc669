import { NavLink as RouterNavLink, useLocation, useSearchParams } from "react-router-dom";
import { DateRangeToggle } from "./DateRangeToggle";
import { SyncButton } from "./SyncButton";
import { SyncStatus } from "./SyncStatus";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { PACCLogo } from "./PACCLogo";
import { supabase } from "@/integrations/supabase/client";
import { useDemoContext } from "@/hooks/useDemo";
import { GlobalThemeToggle } from "./GlobalThemeToggle";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/dispatch", label: "Dispatch" },
  { to: "/customers", label: "Customers" },
  { to: "/finance", label: "Finance" },
  { to: "/trucks", label: "Trucks" },
  { to: "/suppliers", label: "Suppliers" },
  { to: "/market", label: "Market Intel" },
  { to: "/portal", label: "Client Portal", demoOnly: true },
  { to: "/driver", label: "Driver Portal", demoOnly: true },
  { to: "/admin", label: "Admin" },
];

// In demo mode the sidebar is rebuilt as the customer-portal tab list.
// Each entry deep-links into /portal with a ?tab= param the page reads.
const demoPortalNavItems = [
  { to: "/portal", label: "Overview",   tab: "Overview" },
  { to: "/portal", label: "Deliveries", tab: "Deliveries" },
  { to: "/portal", label: "Fleet",      tab: "Fleet" },
  { to: "/portal", label: "Reports",    tab: "Reports" },
  { to: "/portal", label: "Profile",    tab: "Profile" },
];

/** Build sidebar link href, preserving demo params and optional ?tab=. */
function buildHref(to: string, tab: string | undefined, demoSuffix: string, params: URLSearchParams) {
  if (!tab) return `${to}${demoSuffix}`;
  const next = new URLSearchParams(params);
  next.set("tab", tab);
  return `${to}?${next.toString()}`;
}

// PACC brand colors fall back to CSS theme tokens so light/dark flips work.
const PACC_BG = "var(--background)";
const PACC_SIDEBAR_BG = "var(--muted)";
const PACC_BORDER = "var(--border)";
const PACC_ACCENT = "var(--accent)";
const PACC_TEXT_DIM = "var(--muted-foreground)";
const PACC_TEXT_ACTIVE = "var(--foreground)";
const PACC_ACTIVE_BG = "var(--background)";

// Neutral demo colors
const DEMO_BG = "#1a1f2e";
const DEMO_BORDER = "#3d4459";
const DEMO_ACCENT = "#C8F26A";
const DEMO_TEXT_DIM = "#9ca3b8";
const DEMO_TEXT_ACTIVE = "#e8eaf0";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDemo, accentColor, isPaccBranded, isEmailPortalDemo } = useDemoContext();
  const [params] = useSearchParams();
  const bannerOffset = 0;

  // Date range toggle is global state — only show it on routes whose pages
  // actually consume it. Otherwise clicking Today/Week/Month does nothing
  // visible and that's confusing UX.
  const dateRangeRoutes = ["/", "/customers", "/transactions", "/trucks", "/performance", "/finance"];
  const showDateRange = dateRangeRoutes.some((r) =>
    r === "/" ? location.pathname === "/" : location.pathname === r || location.pathname.startsWith(r + "/")
  );

  // Demo mode (whether via ?demo=true or email portal showcase): replace
  // the admin sidebar with the customer-portal tab list so the showcase
  // matches what a real customer would see.
  const visibleNavItems: Array<{ to: string; label: string; tab?: string }> = isDemo
    ? demoPortalNavItems
    : navItems.filter(item => !item.demoOnly);

  // PACC-branded demo keeps the production palette
  const useDemoPalette = isDemo && !isPaccBranded;
  const BG = useDemoPalette ? DEMO_BG : PACC_BG;
  const SIDEBAR_BG = useDemoPalette ? DEMO_BG : PACC_SIDEBAR_BG;
  const ACTIVE_BG = useDemoPalette ? "rgba(255,255,255,0.04)" : PACC_ACTIVE_BG;
  const BORDER = useDemoPalette ? DEMO_BORDER : PACC_BORDER;
  const DEFAULT_ACCENT = useDemoPalette ? DEMO_ACCENT : PACC_ACCENT;
  const TEXT_DIM = useDemoPalette ? DEMO_TEXT_DIM : PACC_TEXT_DIM;
  const TEXT_MID = TEXT_DIM;
  const TEXT_ACTIVE = useDemoPalette ? DEMO_TEXT_ACTIVE : PACC_TEXT_ACTIVE;

  const ACCENT = (accentColor && useDemoPalette) ? `hsl(${accentColor})` : DEFAULT_ACCENT;
  // For inline-style backgrounds that need an alpha overlay we can't use a
  // CSS var directly inside `${ACCENT}11`. Use accent-light token instead.
  const ACCENT_OVERLAY = useDemoPalette ? `${ACCENT}11` : "var(--accent-light)";
  const demoSuffix = isDemo ? `?${params.toString()}` : "";

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: BG, color: TEXT_ACTIVE }}>
      {/* Skip-link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only"
        style={{
          position: "absolute",
          left: 8,
          top: 8,
          zIndex: 200,
          background: BG,
          color: TEXT_ACTIVE,
          border: `1px solid ${ACCENT}`,
          padding: "8px 12px",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        Skip to main content
      </a>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className="hidden md:flex"
        style={{
          width: 240,
          background: SIDEBAR_BG,
          borderRight: `1px solid ${BORDER}`,
          flexDirection: "column",
          padding: `${28 + bannerOffset}px 0 28px`,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: "0 24px", marginBottom: 40 }}>
          <PACCLogo size="md" />
        </div>

        <nav style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 12px", gap: 2 }}>
          {visibleNavItems.map((item, i) => {
            const currentTab = params.get("tab");
            const isActive = item.tab
              ? location.pathname.startsWith(item.to) && (currentTab ? currentTab === item.tab : item.tab === "Overview")
              : item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <RouterNavLink
                key={item.label}
                to={buildHref(item.to, item.tab, demoSuffix, params)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  textDecoration: "none",
                  borderRadius: 8,
                  background: isActive ? ACTIVE_BG : "transparent",
                  border: isActive ? `1px solid ${BORDER}` : "1px solid transparent",
                  borderLeft: isActive ? `2px solid ${ACCENT}` : "2px solid transparent",
                  transition: "all 0.15s",
                  minHeight: 36,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? TEXT_ACTIVE : TEXT_MID,
                    letterSpacing: 0,
                  }}
                >
                  {item.label}
                </span>
              </RouterNavLink>
            );
          })}
        </nav>

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 12 }}>
          <SyncStatus />
          <button
            type="button"
            onClick={async () => { sessionStorage.removeItem("demo_unlocked"); await supabase.auth.signOut(); window.location.href = isDemo ? "/landing" : "/login"; }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 9999,
              color: TEXT_ACTIVE, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "8px 14px",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE FULL-SCREEN MENU ── */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: SIDEBAR_BG,
            display: "flex",
            flexDirection: "column",
          }}
          className="md:hidden"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <PACCLogo size="sm" />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: "transparent", border: "none", color: TEXT_MID, cursor: "pointer", padding: 4 }}
            >
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>

          <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {visibleNavItems.map((item, i) => {
              const currentTab = params.get("tab");
              const isActive = item.tab
                ? location.pathname.startsWith(item.to) && (currentTab ? currentTab === item.tab : item.tab === "Overview")
                : item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              return (
                <RouterNavLink
                  key={item.label}
                  to={buildHref(item.to, item.tab, demoSuffix, params)}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "18px 24px",
                    textDecoration: "none",
                    borderBottom: `1px solid ${BORDER}`,
                    background: isActive ? ACTIVE_BG : "transparent",
                    borderLeft: isActive ? `3px solid ${ACCENT}` : "3px solid transparent",
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? TEXT_ACTIVE : TEXT_MID,
                      letterSpacing: 0,
                    }}
                  >
                    {item.label}
                  </span>
                </RouterNavLink>
              );
            })}
          </nav>

          <div style={{ padding: "20px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 12 }}>
            <SyncStatus />
            <button
              type="button"
              onClick={async () => { sessionStorage.removeItem("demo_unlocked"); await supabase.auth.signOut(); window.location.href = isDemo ? "/landing" : "/login"; }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8,
                color: TEXT_DIM, fontSize: 13, cursor: "pointer", padding: "10px 16px",
              }}
            >
              <LogOut style={{ width: 14, height: 14 }} />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            background: BG,
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            position: "sticky",
            top: bannerOffset,
            zIndex: 50,
          }}
        >
          <div
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              gap: 8,
              minWidth: 0,
            }}
          >
            {/* Mobile header */}
            <div className="md:hidden" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                color: TEXT_MID,
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Menu style={{ width: 16, height: 16 }} />
            </button>
            <PACCLogo size="sm" />
            </div>

            <div className="hidden md:block" />

            {/* Desktop right cluster */}
            <div className="hidden md:flex" style={{ alignItems: "center", gap: 8 }}>
              <SyncButton />
              {showDateRange && <DateRangeToggle />}
              <GlobalThemeToggle compact />
            </div>

            {/* Mobile right cluster */}
            <div className="flex md:hidden" style={{ alignItems: "center", gap: 8, flexShrink: 0 }}>
              <SyncButton />
              <GlobalThemeToggle compact />
            </div>
          </div>

          {/* Mobile second row: date range toggle aligned right to mirror the
              breadcrumb pattern (next to page H1 rather than its own band). */}
          {showDateRange && (
            <div
              className="flex md:hidden"
              style={{
                justifyContent: "flex-end",
                padding: "4px 12px 6px",
                borderTop: `1px solid ${BORDER}`,
              }}
            >
              <DateRangeToggle />
            </div>
          )}
        </header>

        <main
          id="main-content"
          style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}
          className="px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
