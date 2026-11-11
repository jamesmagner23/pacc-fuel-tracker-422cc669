# Architecture rules

- Keep sync-only cron-token verification isolated in the sync function, with service-role-only credential reads and admin JWT fallback, so scheduler authentication cannot grant user privileges.
- Use shared Melbourne timestamp and one-hour freshness utilities for sync displays, and only successful syncs as freshness evidence, so all views agree without exposing sync error logs to clients.
- Resolve transaction sell prices in an authenticated read-only function after RLS filters requested IDs; share its pure calculator with frontend tests and never return supplier costs, so portal prices remain private and consistent across date filters.
- Use actual calendar-week customer volumes and the shared historical supplier-aware buy selector for Client Pricing tiers, preserving their existing formulas, so pagination cannot change a ticket's derived price.
- Treat any unpriced period volume as incomplete reporting and suppress percentage comparisons involving zero, so missing rates never appear as measured losses.
- Fetch transaction pages with exact server counts and 50-row ranges; fetch export rows separately using identical filters, so the visible page cannot silently truncate an export.
- Bound Data Health and external outreach requests with finite timeouts and explicit retries, so empty or failed requests never remain loading indefinitely.
- Drive staff and portal tabs from router state with push navigation and separate keys for nested tabs, so bookmarks and browser Back restore the selected view.
- Fetch Customers through role-checked server summaries and signed dockets through 25-row metadata pages; load signatures only on opening, so lists avoid full-history and image payloads.
- Keep uploaded signed dockets in private storage with customer-linked records and own-client read policies; validate linked deliveries and transactions before insertion, so cross-customer attachments cannot be published.
- Remove dockets from lists through additive archive records rather than deleting deliveries or files, so original operational records remain intact.
- Retrieve authentication emails through an admin-checked directory function, so user listings never depend on redacted role-table email values.
- Keep only the landing page eager and load staff layouts and pages in lazy chunks, so public visitors do not download operational libraries.
- Classify unknown routes before authentication redirects and render a noindex NotFound page, so public URLs never become login or dashboard redirects.
- Aggregate customer sell revenue inside the authenticated shared pricing function with admin-only summary access, so lists reuse ticket pricing without exposing supplier data.
- Report entry gzip sizes from the production bundle hook rather than estimating from source, so performance comparisons use generated code.
