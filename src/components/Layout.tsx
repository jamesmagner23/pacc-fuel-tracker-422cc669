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
  { to: "/customers", label: "Customers" },
  { to: "/crm", label: "CRM" },
  { to: "/finance", label: "Finance" },
  { to: "/suppliers", label: "Suppliers" },
  { to: "/dispatch", label: "Dispatch" },
  { to: "/trucks", label: "Trucks" },
  { to: "/portal", label: "Client Portal", demoOnly: true },
  { to: "/driver", label: "Driver Portal", demoOnly: true },
  { to: "/admin", label: "Admin" },
];

// PACC brand colors fall back to CSS theme tokens so light/dark flips work.
const PACC_BG = "var(--background)";
const PACC_BORDER = "var(--border)";
const PACC_ACCENT = "var(--accent)";
const PACC_TEXT_DIM = "var(--text-secondary)";
const PACC_TEXT_ACTIVE = "var(--text-primary)";

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

  // Email outreach demo: only expose Client Portal in the sidebar
  const visibleNavItems = isEmailPortalDemo
    ? navItems.filter(item => item.to === "/portal")
    : navItems.filter(item => !item.demoOnly || isDemo);

  // PACC-branded demo keeps the production palette
  const useDemoPalette = isDemo && !isPaccBranded;
  const BG = useDemoPalette ? DEMO_BG : PACC_BG;
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
      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className="hidden md:flex"
        style={{
          width: 220,
          background: BG,
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

        <nav style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 16px" }}>
          {visibleNavItems.map((item, i) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <RouterNavLink
                key={item.to}
                to={`${item.to}${demoSuffix}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 8px",
                  textDecoration: "none",
                  borderBottom: `1px solid ${BORDER}`,
                  background: "transparent",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: isActive ? ACCENT : TEXT_DIM,
                    fontWeight: 600,
                    width: 16,
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0.05em",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? TEXT_ACTIVE : TEXT_MID,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: ACCENT,
                      flexShrink: 0,
                    }}
                  />
                )}
              </RouterNavLink>
            );
          })}
        </nav>

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 12 }}>
          <SyncStatus />
          <button
            onClick={async () => { sessionStorage.removeItem("demo_unlocked"); await supabase.auth.signOut(); window.location.href = isDemo ? "/landing" : "/login"; }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8,
              color: TEXT_DIM, fontSize: 12, cursor: "pointer", padding: "8px 12px",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_ACTIVE; e.currentTarget.style.borderColor = ACCENT; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.borderColor = BORDER; }}
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
            background: BG,
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
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: "transparent", border: "none", color: TEXT_MID, cursor: "pointer", padding: 4 }}
            >
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>

          <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {visibleNavItems.map((item, i) => {
              const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              return (
                <RouterNavLink
                  key={item.to}
                  to={`${item.to}${demoSuffix}`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "18px 24px",
                    textDecoration: "none",
                    borderBottom: `1px solid ${BORDER}`,
                    background: isActive ? ACCENT_OVERLAY : "transparent",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: isActive ? ACCENT : TEXT_DIM,
                      fontWeight: 600,
                      width: 20,
                      flexShrink: 0,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? TEXT_ACTIVE : TEXT_MID,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <span
                      style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: ACCENT }}
                    />
                  )}
                </RouterNavLink>
              );
            })}
          </nav>

          <div style={{ padding: "20px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 12 }}>
            <SyncStatus />
            <button
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

          {/* Mobile second row: one date range toggle, full-width and touch-friendly */}
          {showDateRange && (
            <div
              className="flex md:hidden"
              style={{
                justifyContent: "center",
                padding: "8px 12px 10px",
                borderTop: `1px solid ${BORDER}`,
              }}
            >
              <DateRangeToggle />
            </div>
          )}
        </header>

        <main
          style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}
          className="px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
