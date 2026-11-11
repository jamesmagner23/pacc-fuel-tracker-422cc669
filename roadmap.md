# Batch 1

- [x] Add private cron-token authentication without weakening admin authentication.
- [x] Replace the 15-minute HTTP job with runtime token lookup and 120-second timeout. Completed directly by the user, no further action requested.
- [x] Return non-200 on sync failures and retain sync logging.
- [x] Show full Melbourne last-success timestamps and warnings after one hour everywhere.
- [x] Verify authentication and timestamp rules: 12 tests passed and deployed invalid credentials return 401.
- [ ] Authenticated display verification. Blocked: no matching managed session for the requesting user, preview sign-in required.
- [ ] Scheduled end-to-end verification. Blocked: custom HTTP job modification unavailable, and running the existing upsert would modify transactions contrary to the stated data-safety rule.

# Batch 2

- [ ] Shared historical transaction sell pricing, missing-rate states and matching exports, with client-safe access.
- [ ] Missing-rate reporting and safe zero-value deltas in Finance, EBITDA, P&L and Overview.
- [ ] Reconciliation no-data state.
- [ ] Data Health and Pipedrive finite loading, errors, retry and empty states.
- [ ] Transactions date filters, exact-count server pagination of 50 and range-wide search.
- [ ] Melbourne future excise indexation countdown.
- [ ] Focused tests and read-only verification, list changed files.