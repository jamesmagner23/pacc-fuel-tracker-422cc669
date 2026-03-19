import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { Fuel, LayoutDashboard, Users, Truck, List, UserCheck, DollarSign } from "lucide-react";
import { DateRangeToggle } from "./DateRangeToggle";
import { SyncButton } from "./SyncButton";
import { SyncStatus } from "./SyncStatus";

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/trucks", label: "Trucks", icon: Truck },
  { to: "/drivers", label: "Drivers", icon: UserCheck },
  { to: "/transactions", label: "Transactions", icon: List },
];

const activeStyle = {
  display: "flex" as const,
  alignItems: "center" as const,
  gap: 9,
  padding: "6px 10px",
  borderRadius: 7,
  fontSize: 13,
  fontWeight: 500,
  color: "#ffffff",
  background: "rgba(255,255,255,0.07)",
  textDecoration: "none" as const,
};

const inactiveStyle = {
  display: "flex" as const,
  alignItems: "center" as const,
  gap: 9,
  padding: "6px 10px",
  borderRadius: 7,
  fontSize: 13,
  fontWeight: 400,
  color: "#5a5a5a",
  background: "transparent",
  textDecoration: "none" as const,
};

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0C0C0C" }}>
      {/* Top bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#0C0C0C",
          borderBottom: "1px solid #1a1a1a",
          height: 52,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Fuel style={{ width: 15, height: 15, color: "#ffffff" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#ffffff", letterSpacing: "-0.01em" }}>PACC Fuel</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SyncStatus />
          <SyncButton />
          <DateRangeToggle />
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar desktop */}
        <aside
          className="hidden md:flex"
          style={{
            width: 200,
            background: "#0C0C0C",
            borderRight: "1px solid #1a1a1a",
            padding: "8px 6px",
            flexDirection: "column",
            gap: 2,
            flexShrink: 0,
          }}
        >
          {navItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);

            return (
              <RouterNavLink key={item.to} to={item.to} style={isActive ? activeStyle : inactiveStyle}>
                <item.icon
                  style={{
                    width: 14,
                    height: 14,
                    flexShrink: 0,
                    color: isActive ? "#ffffff" : "#444444",
                  }}
                />
                {item.label}
              </RouterNavLink>
            );
          })}
        </aside>

        <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto", paddingBottom: 80 }}>{children}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav
        className="md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "#0C0C0C",
          borderTop: "1px solid #1a1a1a",
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "0 8px",
        }}
      >
        {navItems.map((item) => {
          const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);

          return (
            <RouterNavLink
              key={item.to}
              to={item.to}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "4px 8px",
                fontSize: 10,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "#ffffff" : "#4a4a4a",
                textDecoration: "none",
              }}
            >
              <item.icon style={{ width: 19, height: 19 }} />
              {item.label}
            </RouterNavLink>
          );
        })}
      </nav>
    </div>
  );
}
