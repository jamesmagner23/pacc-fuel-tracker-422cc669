# PACC Energy — Corporate B2B Redesign

Refactor the marketing landing page, the internal operations dashboard, and the customer portal to a light, corporate, Australian B2B aesthetic modelled on breadcrumb.co. Rolled out in 7 sequential phases inside a single working session.

---

## Phase 1 — Tokens & typography

**Goal:** flip the whole app from dark-only to light-first.

- Rewrite `src/index.css` with new light tokens (`--background: #FFFFFF`, `--foreground: #0E1F10`, `--muted: #F4F5F1`, `--primary: #0E1F10`, `--accent: #C8F26A` restricted to badges/keylines, `--destructive: #B43A2E`).
- Add proper dark-mode mapping under `.dark`.
- Pill radius variable `--radius-pill: 9999px`; soft `--radius: 12px` for cards; `--radius-sm: 6px` for inputs.
- Inter only (drop Archivo). Type scale: Display XL/L/M, Heading L/M/S, Body L/Body/Body S, Caption.
- Sentence-case headings, all-caps only on `.eyebrow`.
- Add `tailwind.config.ts` `pill` radius and updated font-size scale.
- Keep legacy `--surface*` / `--text-*` aliases so dependent pages don't shatter before Phase 5.

**Status:** done.

---

## Phase 2 — Shared components

**Goal:** every shadcn primitive matches the spec.

- `Button`: pill radius, 40px default / 32 sm / 48 lg, primary dark-green on white, ghost transparent, secondary muted, destructive clay-red.
- `Badge`: pill radius, new variants `accent`, `success`, `warning`, plus restyled defaults.
- `Input`, `Select`, `Textarea`: 40px height, 6px radius, ring on focus (handled by global `:focus-visible`).
- `Tabs`: underline-only with 2px lime indicator on active.
- `Table`: muted header row, hover `#FAFBF7`, tabular-nums on numeric cells.
- `Sidebar`: 240px, muted bg, ghost nav items, active = white card with 2px lime left border. Remove "01–08" numeric prefixes.
- `PACCLogo`: light-tone default (dark-green wordmark on white).

**Status:** Button, Badge, Sidebar chrome, PACCLogo done. Tabs / Table refinement still to do during full page passes.

---

## Phase 3 — Landing page rebuild (`/landing`)

**Goal:** breadcrumb-style marketing site.

- Sticky white nav with PACC wordmark, ghost section links, phone pill, Demo (ghost), "Get a quote" (primary).
- Mobile hamburger sheet with the same items + phone + both CTAs.
- Hero: 60/40 two-column. Eyebrow accent pill, Display XL headline ending in a full stop, 2-sentence subhead, primary + secondary CTAs, 4-stat trust strip, hero photo at 4:3 with 1px border.
- Logo strip on muted panel (Ironside, Track Works, Keller, Coates, Fulton Hogan, Gearon).
- Services: 4-up card grid, lime-tinted icon chip, sentence-case headings.
- Dark "Customer portal" feature section — the one dramatic dark band.
- Testimonials: 3 cards with real quotes (Mark Webb, Mohamed Hamed, Mo Haider).
- Coverage: 2-col tick list on muted panel.
- About + photo.
- Contact / quote: split layout with phone + email left, QuoteForm card right.
- Footer: wordmark, contact, platform links, copyright row.
- Phone `0409 704 327`, email `fuel@paccvictoria.com` — wired everywhere via two constants.
- `/landing` route remains public regardless of auth state.

**Status:** done.

---

## Phase 4 — Move dashboard to `/app/*`

**Goal:** stop hijacking `/` from the marketing site.

- Move admin routes from `/`, `/customers`, `/finance`, … to `/app`, `/app/customers`, `/app/finance`, …
- Root `/` redirects: signed-in admin → `/app`, signed-in client → `/portal`, signed-in driver → `/driver`, anon → `/landing`.
- Update sidebar `Link` targets, breadcrumbs, internal `navigate(...)` calls, and the `?demo=true` href builder so the demo flag survives navigation.
- Update `LandingPage` "Try Demo" to `/app?demo=true`.
- Update `sitemap.xml` entries.

**Status:** pending.

---

## Phase 5 — Dashboard + customer portal restyle

**Goal:** apply tokens and spec rules to every dashboard page and the portal.

- Per-page H1 (Display M) + Body S subtitle on Overview, Customers, Finance, Suppliers, Market Intel, Dispatch, Trucks, Admin.
- Period filter → segmented pill control, right-aligned in page header.
- KPI tile spec applied uniformly (label, value, optional delta pill, optional sparkline).
- Recharts palette swapped to `--foreground` line + `--muted-foreground` axes; lime reserved for highlight points only.
- Mapbox style → `mapbox/light-v11` everywhere it's used.
- Top customers donut → horizontal bar chart.
- **Overview revenue tile**: fix the calculation mismatch between Overview header KPI and Finance gross-revenue figure — they must share one selector (`useFinancialSummary` ex-GST × 1.1 for inc-GST display).
- Customer portal (`/portal`): apply identical chrome — white shell, muted left nav, dark-green primary buttons. Keep the existing theme toggle.
- Driver portal: same chrome but with 44px touch targets preserved.

**Status:** pending.

---

## Phase 6 — Quote form backend

**Goal:** the landing-page quote form actually delivers.

- Confirm `quote_leads` table + RLS already exists; if missing, migration to add it (id, company, contact_name, phone, site_address, delivery_date nullable, source, user_agent, created_at).
- Anon role: INSERT only (no SELECT). Admin role: SELECT.
- Edge function `notify-quote-lead`: trigger on INSERT via `pg_net` webhook or call directly from client after insert. Sends email to `notifyhq@paccvictoria.com` via existing Gmail connector flow (per session decision; switch to Lovable Emails later if deliverability becomes an issue).
- Surface incoming leads in `/app/admin` under a "Quote requests" tab with status (new / contacted / quoted / won / lost).

**Status:** pending.

---

## Phase 7 — SEO, assets, demo data sanitize

**Goal:** ship-ready public surface.

- `index.html`: tighten `<title>` + `<meta name="description">` to keyword-rich Melbourne-focused copy, set Open Graph + Twitter card with the new hero image, set `theme-color` to `#FFFFFF`.
- JSON-LD `LocalBusiness` schema in `index.html` head with phone, address, opening hours, areas served.
- `sitemap.xml`: include `/landing`, `/portal`, `/login`, no `/app/*` routes.
- Compress hero JPG to WebP @ 1200w / 800w / 400w (already partial — finish the set and add `<picture>` everywhere).
- Compress gallery JPGs (truck-side, truck-refuel, truck-delivery) to WebP under 200KB each.
- Anonymise `src/data/demoData.ts`: replace any names that mirror real customer names with fully neutral placeholders (Kelly Excavation, Metro Cranes, Citywide Earthworks, etc.) — already mostly neutral, audit and confirm.
- Add `<link rel="preload">` for the LCP hero WebP.

**Status:** pending.

---

## Decisions locked

- **Phone:** `0409 704 327` (real, from existing site constant).
- **Email:** `fuel@paccvictoria.com` (existing).
- **Quote-form delivery:** existing Gmail connector flow (fastest). Lovable Emails on `paccenergy.com` deferred.
- **Demo dataset:** already synthetic; Phase 7 does a confirmation audit, not a rewrite.
- **Dark mode:** preserved under `.dark` class for the existing portal theme toggle. Default is light.

## Out of scope this pass

- RLS audit on `transactions`, `client_accounts`, `buy_prices` (Phase 7b, if needed).
- New brand TGP scrapers (separate plan, see git history).
- Bringing back the Archivo display font.