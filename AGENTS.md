# Architecture rules

- Keep sync-only cron-token verification isolated in the sync function, with service-role-only credential reads and admin JWT fallback, so scheduler authentication cannot grant user privileges.
- Use shared Melbourne timestamp and one-hour freshness utilities for sync displays, and only successful syncs as freshness evidence, so all views agree without exposing sync error logs to clients.
- Resolve transaction sell prices in an authenticated read-only function after RLS filters requested IDs; share its pure calculator with frontend tests and never return supplier costs, so portal prices remain private and consistent across date filters.
- Use actual calendar-week customer volumes and historical buy prices for Client Pricing tiers, preserving their existing formulas, so pagination cannot change a ticket's derived price.
- Treat any unpriced period volume as incomplete reporting and suppress percentage comparisons involving zero, so missing rates never appear as measured losses.