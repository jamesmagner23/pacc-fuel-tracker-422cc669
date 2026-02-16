import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Fuel, LayoutDashboard, MapPin, Wrench, List, Bell, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const portalDateRanges = ["This Week", "This Month", "This Quarter"] as const;
export type PortalDateRange = typeof portalDateRanges[number];

const tabs = [
  { to: "/portal", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/portal/sites", label: "Sites", icon: MapPin },
  { to: "/portal/equipment", label: "Equipment", icon: Wrench },
  { to: "/portal/history", label: "History", icon: List },
  { to: "/portal/notifications", label: "Settings", icon: Bell },
];

export function PortalLayout({ children, dateRange, onDateRangeChange }: {
  children: React.ReactNode;
  dateRange: PortalDateRange;
  onDateRangeChange: (r: PortalDateRange) => void;
}) {
  const { companyName, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg tracking-tight">PACC Fuel</span>
            {companyName && (
              <span className="hidden sm:inline text-sm text-muted-foreground ml-2">— {companyName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
              {portalDateRanges.map((r) => (
                <button
                  key={r}
                  onClick={() => onDateRangeChange(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    dateRange === r
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button onClick={signOut} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground text-xs font-medium transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-border/50 bg-background/50">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.end
              ? location.pathname === tab.to
              : location.pathname.startsWith(tab.to);
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-3 text-center text-[10px] text-muted-foreground">
        Powered by PACC Fuel
      </footer>
    </div>
  );
}
