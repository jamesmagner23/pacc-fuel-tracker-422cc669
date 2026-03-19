cat > src/components/Layout.tsx << 'EOF'
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { Fuel, LayoutDashboard, Users, Truck, List, UserCheck } from "lucide-react";
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

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"#0C0C0C" }}>
      <header style={{ position:"sticky", top:0, zIndex:50, background:"#0C0C0C", borderBottom:"1px solid #1a1a1a", height:52, display:"flex", alignItems:"center", padding:"0 20px", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Fuel style={{ width:15, height:15, color:"#ffffff" }} />
          <span style={{ fontWeight:600, fontSize:14, color:"#ffffff", letterSpacing:"-0.01em" }}>PACC Fuel</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <SyncStatus /><SyncButton /><DateRangeToggle />
        </div>
      </header>
      <div style={{ display:"flex", flex:1 }}>
        <aside style={{ width:200, background:"#0C0C0C", borderRight:"1px solid #1a1a1a", padding:"8px 6px", display:"flex", flexDirection:"column", gap:2, flexShrink:0 }} className="hidden md:flex">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <RouterNavLink key={item.to} to={item.to}
                style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 10px", borderRadius:7, fontSize:13, fontWeight: isActive ? 500 : 400, color: isActive ? "#ffffff" : "#5a5a5a", background: isActive ? "rgba(255,255,255,0.07)" : "transparent", textDecoration:"none", transition:"all 0.1s" }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color="#888888"; }}}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.color="#5a5a5a"; }}}
              >
                <item.icon style={{ width:14, height:14, flexShrink:0, color: isActive ? "#ffffff" : "#444444" }} />
                {item.label}
              </RouterNavLink>
            );
          })}
        </aside>
        <main style={{ flex:1, padding:"24px 28px", overflowY:"auto", paddingBottom:80 }}>{children}</main>
      </div>
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, background:"#0C0C0C", borderTop:"1px solid #1a1a1a", height:58, display:"flex", alignItems:"center", justifyContent:"space-around", padding:"0 8px" }} className="md:hidden">
        {navItems.map((item) => {
          const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <RouterNavLink key={item.to} to={item.to}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"4px 8px", fontSize:10, fontWeight: isActive ? 500 : 400, color: isActive ? "#ffffff" : "#4a4a4a", textDecoration:"none" }}
            >
              <item.icon style={{ width:19, height:19 }} />
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