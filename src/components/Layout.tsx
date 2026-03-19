import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { DateRangeToggle } from "./DateRangeToggle";
import { SyncButton } from "./SyncButton";
import { SyncStatus } from "./SyncStatus";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/customers", label: "Customers" },
  { to: "/trucks", label: "Trucks" },
  { to: "/drivers", label: "Drivers" },
  { to: "/transactions", label: "Transactions" },
  { to: "/finance", label: "Finance" },
  { to: "/alerts", label: "Alerts" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#080808", color: "#ffffff" }}>
      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex"
        style={{
          width: 220,
          background: "#080808",
          borderRight: "1px solid #111111",
          display: "flex",
          flexDirection: "column",
          padding: "28px 0",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        {/* Wordmark */}
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

        {/* Nav items */}
        <nav style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 16px", gap: 0 }}>
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
                    color: isActive ? "#444444" : "#222222",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
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
                    transition: "color 0.15s",
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

        {/* Bottom — sync status */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #111111" }}>
          <SyncStatus />
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <header
          style={{
            height: 48,
            background: "#080808",
            borderBottom: "1px solid #111111",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 24px",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 50,
            gap: 8,
          }}
        >
          <SyncButton />
          <DateRangeToggle />
        </header>

        <main style={{ flex: 1, padding: "32px 32px", overflowY: "auto", paddingBottom: 80 }}>{children}</main>
      </div>

      {/* Bottom nav — mobile */}
      <nav
        className="md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "#080808",
          borderTop: "1px solid #111111",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "0 8px",
        }}
      >
        {navItems.slice(0, 5).map((item, i) => {
          const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <RouterNavLink
              key={item.to}
              to={item.to}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "4px 6px",
                textDecoration: "none",
              }}
            >
              <span
                style={{ fontSize: 8, color: isActive ? "#555555" : "#222222", fontVariantNumeric: "tabular-nums" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "#ffffff" : "#333333",
                  letterSpacing: "-0.01em",
                }}
              >
                {item.label}
              </span>
            </RouterNavLink>
          );
        })}
      </nav>
    </div>
  );
}
