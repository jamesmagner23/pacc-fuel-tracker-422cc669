import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Menu, X,
  LayoutDashboard, Truck, Wrench, FileBarChart, User as UserIcon,
  Phone, HelpCircle,
} from "lucide-react";
import { PACCLogo } from "../PACCLogo";
import { supabase } from "@/integrations/supabase/client";
import { SidebarUserCard } from "../SidebarUserCard";
import { SearchCommand } from "../topbar/SearchCommand";
import { NotificationsBell } from "../topbar/NotificationsBell";
import { PortalSyncPill } from "./PortalSyncPill";
import { UserMenu } from "../UserMenu";

type NavItem = {
  tab: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** When set, render as an external/route link instead of toggling a tab. */
  href?: string;
  external?: boolean;
};
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Account",
    items: [
      { tab: "Overview", label: "Overview", icon: LayoutDashboard },
      { tab: "Deliveries", label: "Deliveries", icon: Truck },
      { tab: "Fleet", label: "Equipment", icon: Wrench },
      { tab: "Reports", label: "Reports", icon: FileBarChart },
      { tab: "Profile", label: "Profile", icon: UserIcon },
    ],
  },
  {
    label: "Support",
    items: [
      { tab: "ContactDispatch", label: "Contact dispatch", icon: Phone,
        href: "mailto:fuel@paccvictoria.com", external: true },
      { tab: "Help", label: "Help", icon: HelpCircle, href: "/portal/help" },
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
  /** Customer company name for the sidebar context card. */
  customerName?: string;
  /** Optional account # shown under the customer name. */
  accountNumber?: string | null;
  /** Render the demo badge next to the customer name. */
  isDemo?: boolean;
  children: ReactNode;
}

export function PortalLayout({
  activeTab,
  onTabChange,
  brandLogoUrl,
  brandCaption,
  customerName,
  accountNumber,
  isDemo,
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

  // Map a tab name to its real URL under /portal.
  const tabHref = (tab: string) => {
    const slug: Record<string, string> = {
      Overview: "",
      Deliveries: "deliveries",
      Fleet: "fleet",
      Reports: "reports",
      Profile: "profile",
    };
    const next = new URLSearchParams(params);
    // Drop the legacy ?tab= param if present.
    next.delete("tab");
    const qs = next.toString();
    const base = `/portal${slug[tab] ? "/" + slug[tab] : ""}`;
    return qs ? `${base}?${qs}` : base;
  };

  const NavLinkRow = ({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) => {
    const Icon = item.icon;
    const active = activeTab === item.tab;
    const rowClass = [
      "group flex items-center gap-2.5 rounded-lg text-[14px] transition-colors",
      "h-9 pr-3",
      active
        ? "bg-card text-foreground font-semibold border-l-2 border-accent pl-3"
        : "bg-transparent text-muted-foreground hover:bg-card hover:text-foreground border-l-2 border-transparent pl-3",
    ].join(" ");

    // External/route link (mailto, /portal/help, etc.) — no tab toggling.
    if (item.href) {
      if (item.external) {
        return (
          <a href={item.href} onClick={onNavigate} className={rowClass}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </a>
        );
      }
      return (
        <Link to={item.href} onClick={onNavigate} className={rowClass}>
          <Icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      );
    }

    return (
      <Link
        to={tabHref(item.tab)}
        onClick={(e) => {
          onTabChange(item.tab);
          onNavigate?.();
        }}
        className={rowClass}
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
    <div className="px-4 pt-5 pb-4 border-b border-border">
      <div className="flex items-center gap-2">
        {brandLogoUrl ? (
          <>
            <img src={brandLogoUrl} alt={brandCaption || ""} className="h-8 max-w-[140px] object-contain" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">by PACC</span>
          </>
        ) : (
          <PACCLogo size="sm" tone="light" />
        )}
      </div>
      <div
        className="mt-1 text-[11px] font-medium text-muted-foreground"
        style={{ letterSpacing: "0.02em" }}
      >
        Customer portal
      </div>
    </div>
  );

  const initials = useMemo(() => {
    const name = (customerName || "").trim();
    if (!name) return "";
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [customerName]);

  // Deterministic soft tint from the company name hash.
  const avatarBg = useMemo(() => {
    const name = customerName || "PACC";
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 40% 88%)`;
  }, [customerName]);

  const CustomerContextCard = () =>
    !customerName ? null : (
      <div className="px-3 pt-3 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div
            className="shrink-0 inline-flex items-center justify-center text-[13px] font-bold text-foreground"
            style={{ width: 32, height: 32, borderRadius: 8, background: avatarBg }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-[12px] font-bold uppercase text-foreground" style={{ letterSpacing: "0.02em" }}>
                {customerName}
              </span>
              {isDemo && (
                <span
                  className="shrink-0 inline-flex items-center rounded-full text-[10px] font-bold uppercase text-foreground"
                  style={{ padding: "2px 8px", background: "hsl(var(--accent) / 0.3)", letterSpacing: "0.04em" }}
                >
                  Demo
                </span>
              )}
            </div>
            {accountNumber && (
              <div className="text-[11px] font-medium text-muted-foreground truncate">{accountNumber}</div>
            )}
          </div>
        </div>
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
        <CustomerContextCard />
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
          <CustomerContextCard />
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