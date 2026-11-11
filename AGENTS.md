# Architecture rules

- Keep sync-only cron-token verification isolated in the sync function, with service-role-only credential reads and admin JWT fallback, so scheduler authentication cannot grant user privileges.
- Use shared Melbourne timestamp and one-hour freshness utilities for sync displays, and only successful syncs as freshness evidence, so all views agree without exposing sync error logs to clients.