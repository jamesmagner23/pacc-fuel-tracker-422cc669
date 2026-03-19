import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { DateRangeToggle } from "./DateRangeToggle";
import { SyncButton } from "./SyncButton";
import { SyncStatus } from "./SyncStatus";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/customers", label: "Customers" },
  { to: "/performance", label: "Performance" },
  { to: "/transactions", label: "Transactions" },
  { to: "/finance", label: "Finance" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#080808", color: "#ffffff" }}>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className="hidden md:flex"
        style={{
          width: 220,
          background: "#080808",
          borderRight: "1px solid #111111",
          flexDirection: "column",
          padding: "28px 0",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: "0 24px", marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}>PACC</div>
          <div
            style={{
              fontSize: 11,
              color: "#333333",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 1,
            }}
          >
            Fuel
          </div>
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
                  borderBottom: "1px solid #111111",
                  transition: "all 0.15s",
                  background: "transparent",
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
                    color: isActive ? "#7C3AED" : "#222222",
                    fontWeight: 500,
                    width: 16,
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? "#ffffff" : "#3a3a3a",
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
                      background: "#7C3AED",
                      flexShrink: 0,
                    }}
                  />
                )}
              </RouterNavLink>
            );
          })}
        </nav>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #111111" }}>
          <SyncStatus />
        </div>
      </aside>

      {/* ── MOBILE FULL-SCREEN MENU OVERLAY ── */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "#080808",
            display: "flex",
            flexDirection: "column",
            padding: "0 0 40px 0",
          }}
          className="md:hidden"
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid #111111",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>PACC</div>
              <div style={{ fontSize: 10, color: "#333333", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Fuel
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: "transparent", border: "none", color: "#666666", cursor: "pointer", padding: 4 }}
            >
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>

          {/* Nav items — large touch targets */}
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
                    borderBottom: "1px solid #0f0f0f",
                    background: isActive ? "rgba(124,58,237,0.06)" : "transparent",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: isActive ? "#7C3AED" : "#2a2a2a",
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
                      color: isActive ? "#ffffff" : "#444444",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <span
                      style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: "#7C3AED" }}
                    />
                  )}
                </RouterNavLink>
              );
            })}
          </nav>

          {/* Bottom of menu */}
          <div style={{ padding: "20px 24px", borderTop: "1px solid #111111" }}>
            <SyncStatus />
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <header
          style={{
            height: 52,
            background: "#080808",
            borderBottom: "1px solid #111111",
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
          {/* Mobile: hamburger + wordmark */}
          <div className="md:hidden" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "#666666",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Menu style={{ width: 18, height: 18 }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}>PACC Fuel</span>
          </div>

          {/* Desktop: spacer */}
          <div className="hidden md:block" />

          {/* Right side — sync + toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="hidden sm:flex">
              <SyncStatus />
            </div>
            <SyncButton />
            <DateRangeToggle />
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            padding: "20px 16px",
            overflowY: "auto",
            paddingBottom: 80,
            // Desktop padding
          }}
          className="md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
