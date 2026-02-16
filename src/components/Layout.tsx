import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { Fuel, LayoutDashboard, Users, Truck, List, UserCheck, Clock } from "lucide-react";
import { DateRangeToggle } from "./DateRangeToggle";

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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg tracking-tight">PACC Fuel</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Last synced: —</span>
            </div>
            <DateRangeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-56 border-r border-border/50 bg-sidebar p-3 gap-1">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <RouterNavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </RouterNavLink>
            );
          })}
        </aside>

        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 overflow-auto">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <RouterNavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </RouterNavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
