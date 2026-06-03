import { NavLink as RouterNavLink, useLocation, useSearchParams } from "react-router-dom";
import { DateRangeToggle } from "./DateRangeToggle";
import { useState, useEffect, type ComponentType } from "react";
import {
  Menu, X, LogOut,
  LayoutDashboard, Truck, Building2, DollarSign, Package, TrendingUp, Settings, Bus, FolderKanban,
} from "lucide-react";
import { PACCLogo } from "./PACCLogo";
import { supabase } from "@/integrations/supabase/client";
import { useDemoContext } from "@/hooks/useDemo";
import { GlobalThemeToggle } from "./GlobalThemeToggle";
import { UserMenu } from "./UserMenu";
import { SidebarUserCard } from "./SidebarUserCard";
import { SearchCommand } from "./topbar/SearchCommand";
import { TopSyncPill } from "./topbar/TopSyncPill";
import { NotificationsBell } from "./topbar/NotificationsBell";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; demoOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/dispatch", label: "Dispatch", icon: Truck },
      { to: "/customers", label: "Customers", icon: Building2 },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "/finance", label: "Finance", icon: DollarSign },
      { to: "/trucks", label: "Trucks", icon: Bus },
      { to: "/suppliers", label: "Suppliers", icon: Package },
      { to: "/market", label: "Market intel", icon: TrendingUp },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/admin", label: "Admin", icon: Settings },
    ],
  },
];

// In demo mode the sidebar is rebuilt as the customer-portal tab list.
// Each entry deep-links into /portal with a ?tab= param the page reads.
const demoPortalNavItems: Array<NavItem & { tab?: string }> = [
  { to: "/portal", label: "Overview",   tab: "Overview",   icon: LayoutDashboard },
  { to: "/portal", label: "Deliveries", tab: "Deliveries", icon: Truck },
  { to: "/portal", label: "Fleet",      tab: "Fleet",      icon: Bus },
  { to: "/portal", label: "Projects",   tab: "Projects",   icon: FolderKanban },
  { to: "/portal", label: "Reports",    tab: "Reports",    icon: TrendingUp },
  { to: "/portal", label: "Profile",    tab: "Profile",    icon: Settings },
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
  const { isDemo, isPaccBranded } = useDemoContext();
  const [params] = useSearchParams();

  // Pages (currently the mobile Overview) can request the drawer be opened
  // without prop-drilling. Listen globally and react.
  useEffect(() => {
    const open = () => setMobileMenuOpen(true);
    window.addEventListener("pacc:open-nav", open);
    return () => window.removeEventListener("pacc:open-nav", open);
  }, []);

  // Mobile Overview ("/" at < lg) renders its own page chrome and edge-to-edge
  // background, so hide the default header and remove main padding.
  const isOverviewMobile = location.pathname === "/";

  // Date range toggle is global state — only show it on routes whose pages
  // actually consume it. Otherwise clicking Today/Week/Month does nothing
  // visible and that's confusing UX.
  // Date-range toggle in the legacy header — kept ONLY for routes that don't
  // render an inline PageHeader on their own (Overview/Customers/Finance/etc.
  // render their own inline period selector).
  const dateRangeRoutes = ["/transactions", "/performance"];
  const showDateRange = dateRangeRoutes.some((r) =>
    location.pathname === r || location.pathname.startsWith(r + "/")
  );

  const visibleGroups: NavGroup[] = isDemo
    ? [{ label: "Portal", items: demoPortalNavItems }]
    : navGroups;
  // Flat list still useful for the mobile drawer header
  const visibleNavItems = visibleGroups.flatMap((g) => g.items);

  const demoSuffix = isDemo ? `?${params.toString()}` : "";

  function isItemActive(item: NavItem & { tab?: string }): boolean {
    if (item.tab) {
      const currentTab = params.get("tab");
      return location.pathname.startsWith(item.to) &&
        (currentTab ? currentTab === item.tab : item.tab === "Overview");
    }
    return item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
  }

  const NavLinkRow = ({ item, onNavigate }: { item: NavItem & { tab?: string }; onNavigate?: () => void }) => {
    const Icon = item.icon;
    const active = isItemActive(item);
    return (
      <RouterNavLink
        to={buildHref(item.to, item.tab, demoSuffix, params)}
        onClick={onNavigate}
        className={[
          "group flex items-center gap-2.5 rounded-lg text-[14px] transition-colors",
          "h-9 pr-3",
          active
            ? "bg-card text-foreground font-semibold border-l-2 border-accent pl-3"
            : "bg-transparent text-muted-foreground hover:bg-card hover:text-foreground border-l-2 border-transparent pl-3",
        ].join(" ")}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </RouterNavLink>
    );
  };

  const SectionDivider = ({ label }: { label: string }) => (
    <div
      className="mt-4 mb-1.5 pl-1 text-[10px] font-bold uppercase text-muted-foreground/70"
      style={{ letterSpacing: "0.1em" }}
    >
      {label}
    </div>
  );

  const renderGroups = (onNavigate?: () => void) => (
    <>
      {visibleGroups.map((g, idx) => (
        <div key={g.label} className={idx === 0 ? "" : ""}>
          <SectionDivider label={g.label} />
          <div className="flex flex-col gap-1">
            {g.items.map((item) => (
              <NavLinkRow key={item.label + item.to + (("tab" in item ? (item as any).tab : ""))} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Skip-link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only absolute left-2 top-2 z-[200] rounded-md border border-accent bg-background text-foreground px-3 py-2 text-xs"
      >
        Skip to main content
      </a>

      {/* ── DESKTOP SIDEBAR (>= lg) ── */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col"
        style={{ width: 240, background: "var(--muted)", borderRight: "1px solid var(--border)" }}
      >
        <div className="px-4 py-5 border-b border-border">
          <PACCLogo size="sm" tone="light" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4">
          {renderGroups()}
        </nav>
        <div className="border-t border-border mb-4">
          <SidebarUserCard />
        </div>
      </aside>

      {/* ── MOBILE FULL-SCREEN MENU (< lg) ── */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[100] flex flex-col"
          style={{ background: "var(--muted)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <PACCLogo size="sm" tone="light" />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-card"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-3">
            {renderGroups(() => setMobileMenuOpen(false))}
          </nav>
          <div className="border-t border-border mb-3">
            <SidebarUserCard />
          </div>
        </div>
      )}

      {/* ── MAIN COLUMN ── */}
      {/* Sidebar is 240px; use 256px (pl-64) so headings don't kiss the sidebar edge. */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <header
          className={
            "sticky top-0 z-30 border-b border-border bg-background " +
            (isOverviewMobile ? "hidden lg:block" : "")
          }
        >
          <div className="h-14 flex items-center justify-between px-4 sm:px-6 gap-3">
            {/* Left cluster */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex lg:hidden items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="lg:hidden"><PACCLogo size="sm" /></div>
              <div className="hidden md:block"><SearchCommand /></div>
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-2">
              {showDateRange && (
                <div className="hidden md:block"><DateRangeToggle /></div>
              )}
              <TopSyncPill />
              <GlobalThemeToggle compact />
              <NotificationsBell />
              <UserMenu />
            </div>
          </div>
          {showDateRange && (
            <div className="md:hidden flex justify-end px-4 py-2 border-t border-border">
              <DateRangeToggle />
            </div>
          )}
        </header>

        <main
          id="main-content"
          className={
            "flex-1 overflow-y-auto " +
            (isOverviewMobile
              ? "p-0 lg:px-8 lg:py-8 lg:pb-20"
              : "px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 pb-20")
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
