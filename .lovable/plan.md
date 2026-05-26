## Goal

Restructure the Customer Portal (`/portal`) at viewport ≥ 768px to match the same Admindek pattern now used by the operations dashboard: persistent left sidebar with sections + bottom user card, refined top bar (search ⌘K, sync pill, notifications, user menu), H1 + breadcrumb page header, and a rebuilt Overview page (KPI sparkline tiles + Litres growth + Volume by customer + Today's deliveries + map). Use the admin palette exactly — dark green `#0E1F10`, lime `#C8F26A`, off-white `#F4F5F1`. Mobile (<768px) stays as today.

## What changes

### 1. New portal shell — `src/components/portal/PortalLayout.tsx`
- Mirrors `src/components/Layout.tsx` but for client routes.
- Left sidebar 240px, persistent ≥1024px, drawer below.
- Sidebar sections + items:
  - **OVERVIEW** — Overview (`/portal?tab=Overview`)
  - **OPERATIONS** — Deliveries, Fleet
  - **INSIGHTS** — Reports
  - **ACCOUNT** — Profile
- Active item: 2px left lime border + white bg (same as admin).
- Bottom: `SidebarUserCard` (reuse existing) showing company name + "Client" role + sign-out.
- Top bar 56px: drawer trigger (<1024px), search pill with ⌘K, sync pill, notifications bell, user menu. Reuse `topbar/SearchCommand`, `topbar/TopSyncPill`, `topbar/NotificationsBell`, `UserMenu`. The TopSyncPill needs a portal-safe variant that doesn't trigger an admin sync — show "Updated HH:mm" tied to `transactions` last query timestamp, click triggers `queryClient.invalidateQueries`. We'll extend `TopSyncPill` with a `mode="client"` prop or create a small `PortalSyncPill` wrapper.
- Removes the existing portal top header (logo + tabs + theme toggle + user dropdown).
- Removes the portal light/dark toggle entirely — palette is locked to admin colours.

### 2. Refactor `CustomerPortal.tsx`
- Strip the inline-style theming system (`T`, `applyPortalTheme`, `card`, `ghostBtn`, `labelStyle`, `sectionTitle`, `usePortalTheme`, `tokensFor`, `themeVarsFor`, `brandAccentVars`). Replace style usages with Tailwind semantic tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-accent`, etc.) so the page inherits the admin palette via `index.css`.
- Wrap the page in `<PortalLayout>` and remove the in-page header/nav.
- Keep the tab state machine (`?tab=` URL sync) but drive it from sidebar links instead of the old top tab strip. Fleet/Reports subtabs become inline pill controls inside their respective panels (unchanged behaviour).
- Each tab gets `<PageHeader>` at the top:
  - Overview → `PACC Energy / Portal / Overview`
  - Deliveries → `PACC Energy / Portal / Deliveries`
  - Fleet → `PACC Energy / Portal / Fleet`
  - Reports → `PACC Energy / Portal / Reports`
  - Profile → `PACC Energy / Portal / Profile`
- Customer-brand override (logo / accent) survives only as the sidebar header logo. The rest of the UI uses the locked admin palette (per the user's choice).

### 3. Rebuild `OverviewTab`
- **KPI row**: 4 `KPISparklineCard`s — Litres Delivered, Spend (inc GST), Deliveries, Avg Drop Size. Period-aware eyebrows ("Monthly Litres Delivered", etc.). Each tile gets the admin tinted-icon + sparkline treatment (`Droplet` sage, `DollarSign` amber, `Truck` periwinkle, `Gauge` grey).
- **Litres growth + Volume by site row** (`lg:grid-cols-3`):
  - 2/3 area chart of customer litres over time with 7d/30d/90d pill toggle + deliveries-count line.
  - 1/3 donut of "Volume by site" (top 5 of `nombre_sucursal` + Other), centre total, legend with percentages.
- **Today's deliveries + map row**: keep the existing data but restyle with white cards + border tokens to match the admin Today's deliveries panel.
- Remove the old standalone full-width trend chart.
- Page wrapper: `bg-muted` so the white cards pop, identical to admin.

### 4. Other tabs (Deliveries / Fleet / Reports / Profile)
- Restyle only — replace inline-style cards with `bg-card border border-border rounded-xl p-6` etc., remove `T.*` colour references, swap `ghostBtn` with shadcn `Button variant="outline"`. No content/logic changes.
- Charts (recharts) switch stroke/fill to admin palette tokens.
- Welcome modal, Plant board, Filter bar, Account modal: light touch — only the style props that referenced `T.*` get updated.

### 5. Cleanup
- Delete `PortalThemeToggle` usage from CustomerPortal (component file stays for the driver portal until that is migrated separately).
- Update memory `mem://features/portal-theme-toggle` to note the client portal no longer uses the toggle (driver portal still does).

## Out of scope (this prompt)
- Driver portal (`/driver`) — separate ticket.
- Notifications wiring to real data (stub empty state, same as admin).
- Real search results (empty `CommandDialog`, same as admin).
- Mobile (<768px) layout — keep current behaviour.

## Acceptance check
- `/portal` at 1440px shows: 240px sidebar (sections + active highlight + bottom user card) | top bar (search⌘K, sync pill, bell, user menu) | H1 + breadcrumb | KPI sparkline tiles | Litres growth + Volume by site row | Today's deliveries + map row.
- Cmd/Ctrl+K opens the command dialog.
- Sidebar links switch tabs and update `?tab=`.
- No portal light/dark toggle remains on the client portal.
- All cards white on `--muted` bg; lime accent for active state and positive deltas; no inline hex colours from the old `T` palette remain in `CustomerPortal.tsx`.
- No console errors.

## Build order
1. `PortalLayout` + portal-mode `TopSyncPill` + sidebar items.
2. Wrap `CustomerPortal` in `PortalLayout`, remove old header, strip `T`/`applyPortalTheme`.
3. Rebuild `OverviewTab` (KPIs → growth+donut → deliveries+map).
4. Restyle remaining tabs (Deliveries, Fleet, Reports, Profile) to semantic tokens.
5. Visual QA at 1440 / 1024 / 768 / 375.
