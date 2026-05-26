# Customer Portal — Admindek Restructure

Convert the customer portal from a single tabbed 4,200-line page into a routed, Admindek-style app shell that mirrors the operations dashboard, scoped to the signed-in customer via RLS.

## 1. Routing & shell

- `src/App.tsx`: replace `<Route path="/portal" element={<CustomerPortal />} />` (both branches) with a nested `<Route path="/portal" element={<PortalShell />}>` containing index + `deliveries`, `fleet`, `reports`, `profile`, `help`. Demo branch mirrors the same nested routes.
- New `src/components/portal/PortalShell.tsx`: wraps `<PortalLayout>` + `<Outlet />`, derives `activeTab` from `useLocation()` instead of `?tab=`.
- Role redirect (`src/App.tsx`'s post-login effect):
  - `client` → `/portal`
  - `admin` / `operations` / `driver` → `/`
  - unknown → `/` (safer default for internal users)
- `/portal?demo=true` still works — `PortalShell` reads `demo` from search params and threads it through.

## 2. Sidebar (PortalLayout updates)

Replace the current 4 nav groups with 2 sections:

- **ACCOUNT**: Overview, Deliveries, Fleet, Reports, Profile
- **SUPPORT**: Contact dispatch (`mailto:fuel@paccvictoria.com`, falls back to tel:), Help

Add a new **CustomerContextCard** between `SidebarHeader` and `<nav>`:
- 32×32 rounded-square avatar, bg derived from a deterministic hash of `company_name`, centred 2-letter initials.
- Line 1: company name uppercase (truncate). Line 2: `Account #C1004` (hidden if no `account_number`).
- Loads via `useCustomerContext()` hook (new): selects from `client_accounts` for the signed-in user, or returns `{ name: "Demo Customer", isDemo: true }` when `?demo=true`. In demo mode renders a small "DEMO" pill (bg `--accent/30`, color `--foreground`, font 10/700 uppercase).
- 1px bottom border `--border`.

Sub-caption "Customer portal" added under the wordmark in `SidebarHeader` when not in branded mode.

NavLinkRow rewires to real `to={item.href}` and uses `NavLink`'s active state; removes `onTabChange` and the `?tab=` query manipulation. Props `activeTab`/`onTabChange` are dropped.

## 3. Top bar

`PortalLayout` header gets:
- Search placeholder updated to "Search your deliveries, sites, dockets…".
- `NotificationsBell` already exists — extend to show a lime dot when the customer has unread items (count of `delivery_requests` updated since `last_seen_at`, or just `> 0` for now; stub query OK).
- `UserMenu`: add "Account settings" → `/portal/profile`, keep existing Help + Sign out, conditionally include "Switch organisation" only if the user has >1 row in `user_roles` with role `client`.

## 4. Page header with download CTA

New `src/components/portal/PortalPageHeader.tsx`:
- H1 + breadcrumb `<Company> / Customer portal / <Page>` (last segment `--foreground/500`, others `--muted-foreground` with `/` separators).
- Right block: `<DownloadStatementMenu>` (dropdown of: Statement PDF, Deliveries CSV, Tax-credits report YTD, divider, Custom date range…) + `<PeriodSelector>` (Today / Week / Month / YTD / All — default Month).
- Period state lifted into a `PortalPeriodContext` provided by `PortalShell` so Overview KPIs/charts and Deliveries page can subscribe.

`DownloadStatementMenu` invokes a new edge function `export-customer-data` with `{ customer_id, format: 'statement-pdf' | 'deliveries-csv' | 'ftc-pdf', scope: {from, to} }`. Stub edge function returns a placeholder PDF/CSV with the customer name + period; deploys with `verify_jwt = true` (default) so RLS context is preserved via the user's JWT.

## 5. Overview page

Carve current `OverviewTab` out of `CustomerPortal.tsx` into `src/pages/portal/PortalOverview.tsx`. Rebuild the KPI row to exactly 4 tiles using the existing `KPISparklineCard`:

| Tile | Eyebrow | Icon | Container bg | Sparkline |
|---|---|---|---|---|
| Litres delivered | "<PERIOD> LITRES" | Droplet | `#E8EDE5` | `#2A6A2E` |
| Spend | "<PERIOD> SPEND" | DollarSign | `#F4F0E6` | `#7A5300` |
| FTC Savings (featured) | "EST. FTC SAVINGS" | Receipt | `#C8F26A` (lime) | `--foreground` |
| Active sites | "ACTIVE SITES" | MapPin | `#EAEEFC` | `#2B3D8E` |

FTC tile shows a neutral "YTD" pill (not green/red) plus a 11/400 italic sub-line "ATO off-road rate × volume". KPISparklineCard gets an optional `deltaTone: 'positive' | 'negative' | 'neutral'` + `subLine?: string` to support this.

Below KPIs: keep the existing Litres-growth + Volume-by-site donut row from the prior turn (already built), restyled if needed.

Below the chart row: new `<RecentDeliveriesCard>` — white card, header "Recent deliveries" + "View all →" link to `/portal/deliveries`. Table columns Date / Site / Driver / Volume / Docket; 10 rows scoped to the selected period; empty state copy as in spec. Docket cell triggers `export-customer-data` for a single docket PDF.

Remove the old today's-deliveries + map row, or move it under the recent deliveries table — confirm with user (default: move map below the table).

## 6. Sub-route pages

Each new page wraps its content in `<PortalPageHeader />` with its own title/breadcrumb. Initial pass = read-only views fed by existing Supabase queries:

- `PortalDeliveries.tsx`: full deliveries table, filters (date range from PortalPeriodContext, site, driver), pagination 25/page.
- `PortalFleet.tsx`: list of plant items / vehicles refuelled with totals.
- `PortalReports.tsx`: cards for each export (statement, deliveries, FTC, custom).
- `PortalProfile.tsx`: extract existing `ProfileTab` content as-is into its own route file.
- `PortalHelp.tsx`: placeholder contact card.

## 7. Cleanup

- Delete `CustomerPortal.tsx`'s tab switch + `?tab=` URL sync once content is split.
- Page wrapper bg already `--muted` via PortalLayout — verify and remove any cream overrides in extracted tabs.
- Update memory `mem://features/portal-theme-toggle` to note the portal now uses admin palette + sub-routes.

## Out of scope

- Driver portal.
- Real notification feed (just the dot indicator).
- Real CSV/PDF formatting (edge function returns minimal placeholders this pass).
- Mobile redesign beyond the existing drawer collapse.

## Acceptance

Per the user's checklist at the bottom of the request — sidebar replaces tabs, customer name in context card not in H1, breadcrumb under H1, Download statement dropdown in header, 4 KPIs with FTC on lime, charts row, recent deliveries table, page bg `--muted`, role-based sign-in redirect, demo badge, mobile drawer, no console errors.

## Build order

1. New edge function `export-customer-data` (stub).
2. `useCustomerContext` hook + `CustomerContextCard`.
3. `PortalShell` + nested routes in `App.tsx` + role-redirect tweak.
4. `PortalLayout` nav refactor (NavLink + new sections + sub-caption + demo badge).
5. `PortalPageHeader` + `DownloadStatementMenu` + `PortalPeriodContext`.
6. Split `OverviewTab` → `PortalOverview.tsx`, rebuild 4 KPI tiles incl. FTC.
7. `RecentDeliveriesCard`.
8. Extract Deliveries / Fleet / Reports / Profile / Help into route files.
9. Verify demo mode + role redirect + mobile drawer.
