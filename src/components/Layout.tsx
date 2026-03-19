cat > src/components/Layout.tsx << 'EOF'
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Truck, List, UserCheck, DollarSign, Bell, Settings } from "lucide-react";
import { DateRangeToggle } from "./DateRangeToggle";
import { SyncButton } from "./SyncButton";
import { SyncStatus } from "./SyncStatus";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/trucks", icon: Truck, label: "Trucks" },
  { to: "/drivers", icon: UserCheck, label: "Drivers" },
  { to: "/transactions", icon: List, label: "Transactions" },
  { to: "/financials", icon: DollarSign, label: "Financials" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#080808", color: "#ffffff" }}>

      {/* Icon-only sidebar — desktop */}
      <aside style={{
        width: 52,
        background: "#080808",
        borderRight: "1px solid #161616",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 0",
        gap: 4,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
      }} className="hidden md:flex">

        {/* Logo mark */}
        <div style={{
          width: 28, height: 28,
          background: "#ffffff",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 16, flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#080808", letterSpacing: "-0.05em" }}>P</span>
        </div>

        {/* Nav icons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <RouterNavLink
                key={item.to}
                to={item.to}
                title={item.label}
                style={{
                  width: 36, height: 36,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 8,
                  background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  color: isActive ? "#ffffff" : "#3a3a3a",
                  textDecoration: "none",
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLElement).style.color = "#777777";
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "#3a3a3a";
                  }
                }}
              >
                <item.icon style={{ width: 15, height: 15 }} />
              </RouterNavLink>
            );
          })}
        </div>

        {/* Settings at bottom */}
        <RouterNavLink
          to="/settings"
          title="Settings"
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, color: "#3a3a3a", textDecoration: "none" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#777777"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#3a3a3a"; }}
        >
          <Settings style={{ width: 15, height: 15 }} />
        </RouterNavLink>
      </aside>

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: 48,
          background: "#080808",
          borderBottom: "1px solid #161616",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          <div style={{ fontSize: 13, color: "#333333" }}>
            {/* Could show current page title here */}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SyncStatus />
            <SyncButton />
            <DateRangeToggle />
          </div>
        </header>

        <main style={{ flex: 1, padding: "28px 28px", overflowY: "auto", paddingBottom: 80 }}>
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "#080808",
        borderTop: "1px solid #161616",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
      }} className="md:hidden">
        {navItems.slice(0, 5).map((item) => {
          const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <RouterNavLink key={item.to} to={item.to}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 8px", fontSize: 9, fontWeight: isActive ? 500 : 400, color: isActive ? "#ffffff" : "#3a3a3a", textDecoration: "none" }}
            >
              <item.icon style={{ width: 18, height: 18 }} />
              {item.label}
            </RouterNavLink>
          );
        })}
      </nav>
    </div>
  );
}
EOF
echo "✅ Layout done"