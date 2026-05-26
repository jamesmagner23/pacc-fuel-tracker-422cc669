import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Menu, X, LogOut,
  LayoutDashboard, Truck, Bus, TrendingUp, User as UserIcon,
} from "lucide-react";
import { PACCLogo } from "../PACCLogo";
import { supabase } from "@/integrations/supabase/client";
import { SidebarUserCard } from "../SidebarUserCard";
import { SearchCommand } from "../topbar/SearchCommand";
import { NotificationsBell } from "../topbar/NotificationsBell";
import { PortalSyncPill } from "./PortalSyncPill";
import { UserMenu } from "../UserMenu";

type NavItem = { tab: string; label: string; icon: ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { tab: "Overview", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { tab: "Deliveries", label: "Deliveries", icon: Truck },
      { tab: "Fleet",      label: "Fleet",      icon: Bus },
    ],
  },
  {
    label: "Insights",
    items: [
      { tab: "Reports",    label: "Reports",    icon: TrendingUp },
    ],
  },
  {
    label: "Account",
    items: [
      { tab: "Profile",    label: "Profile",    icon: UserIcon },
    ],
  },
];

export interface PortalLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** Customer-facing brand logo to render in the sidebar header (falls back to PACC). */
  brandLogoUrl?: string | null;
  /** Customer-facing brand caption when logo is shown. */
  brandCaption?: string;
  children: ReactNode;
}

export function PortalLayout({
  activeTab,
  onTabChange,
  brandLogoUrl,
  brandCaption,
  children,
}: PortalLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [params] = useSearchParams();

  // Allow pages to request the drawer open (parity with admin Layout).
  useEffect(() => {
    const open = () => setMobileMenuOpen(true);
    window.addEventListener("pacc:open-nav", open);
    return () => window.removeEventListener("pacc:open-nav", open);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // Build the in-portal href that preserves any extra query params.
  const tabHref = (tab: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    return `/portal?${next.toString()}`;
  };

  const NavLinkRow = ({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) => {
    const Icon = item.icon;
    const active = activeTab === item.tab;
    return (
      <Link
        to={tabHref(item.tab)}
        onClick={(e) => {
          // Let react-router handle navigation, but also surface the tab
          // change synchronously so the parent doesn't wait on URL effects.
          onTabChange(item.tab);
          onNavigate?.();
        }}
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
      </Link>
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
      {navGroups.map((g) => (
        <div key={g.label}>
          <SectionDivider label={g.label} />
          <div className="flex flex-col gap-1">
            {g.items.map((item) => (
              <NavLinkRow key={item.tab} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </>
  );

  const SidebarHeader = () => (
    <div className="px-4 py-5 border-b border-border flex items-center gap-2">
      {brandLogoUrl ? (
        <>
          <img src={brandLogoUrl} alt={brandCaption || ""} className="h-8 max-w-[140px] object-contain" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">by PACC</span>
        </>
      ) : (
        <PACCLogo size="sm" tone="light" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only absolute left-2 top-2 z-[200] rounded-md border border-accent bg-background text-foreground px-3 py-2 text-xs"
      >
        Skip to main content
      </a>

      {/* DESKTOP SIDEBAR (>= lg) */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col"
        style={{ width: 240, background: "var(--muted)", borderRight: "1px solid var(--border)" }}
      >
        <SidebarHeader />
        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4">{renderGroups()}</nav>
        <div className="border-t border-border mb-4">
          <SidebarUserCard />
        </div>
      </aside>

      {/* MOBILE FULL-SCREEN MENU (< lg) */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[100] flex flex-col"
          style={{ background: "var(--muted)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <SidebarHeader />
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

      {/* MAIN COLUMN */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-border bg-background">
          <div className="h-14 flex items-center justify-between px-4 sm:px-6 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex lg:hidden items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="lg:hidden">
                {brandLogoUrl ? (
                  <img src={brandLogoUrl} alt={brandCaption || ""} className="h-7 max-w-[120px] object-contain" />
                ) : (
                  <PACCLogo size="sm" />
                )}
              </div>
              <div className="hidden md:block"><SearchCommand /></div>
            </div>
            <div className="flex items-center gap-2">
              <PortalSyncPill />
              <NotificationsBell />
              <UserMenu />
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 pb-20"
        >
          {children}
        </main>
      </div>
    </div>
  );
}