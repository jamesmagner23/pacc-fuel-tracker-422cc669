import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { DateRangeToggle } from "./DateRangeToggle";
import { SyncButton } from "./SyncButton";
import { SyncStatus } from "./SyncStatus";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { PACCLogo } from "./PACCLogo";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/customers", label: "Customers" },
  { to: "/transactions", label: "Transactions" },
  { to: "/finance", label: "Finance" },
  { to: "/admin", label: "Admin" },
];

const BG = "#3D2B1A";
const BORDER = "#6B5240";
const ACCENT = "#E8461E";
const TEXT_DIM = "#C4A882";
const TEXT_MID = "#C4A882";
const TEXT_ACTIVE = "#F5E6D0";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          padding: "28px 0",
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
          {navItems.map((item, i) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <RouterNavLink
                key={item.to}
                to={item.to}
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

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${BORDER}` }}>
          <SyncStatus />
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
            {navItems.map((item, i) => {
              const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              return (
                <RouterNavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "18px 24px",
                    textDecoration: "none",
                    borderBottom: `1px solid #56402E`,
                    background: isActive ? "rgba(255,77,28,0.06)" : "transparent",
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

          <div style={{ padding: "20px 24px", borderTop: `1px solid ${BORDER}` }}>
            <SyncStatus />
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 52,
            background: BG,
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 50,
            gap: 8,
          }}
        >
          {/* Mobile header */}
          <div className="md:hidden" style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="hidden sm:flex">
              <SyncStatus />
            </div>
            <SyncButton />
            <DateRangeToggle />
          </div>
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
