# Batch 1

- [x] Add private cron-token authentication without weakening admin authentication.
- [x] Replace the 15-minute HTTP job with runtime token lookup and 120-second timeout. Completed directly by the user, no further action requested.
- [x] Return non-200 on sync failures and retain sync logging.
- [x] Show full Melbourne last-success timestamps and warnings after one hour everywhere.
- [x] Verify authentication and timestamp rules: 12 tests passed and deployed invalid credentials return 401.
- [ ] Authenticated display verification. Blocked: no matching managed session for the requesting user, preview sign-in required.
- [ ] Scheduled end-to-end verification. Not performed: user completed scheduling, no further action requested and sync upserts would modify protected data.

# Batch 2

- [x] Shared historical transaction sell pricing, missing-rate states and matching exports, with client-safe access.
- [x] Missing-rate reporting and safe zero-value deltas in Finance, EBITDA, P&L and Overview.
- [x] Reconciliation no-data state.
- [x] Data Health and Pipedrive finite loading, errors, retry and empty states.
- [x] Transactions date filters, exact-count server pagination of 50 and range-wide search.
- [x] Melbourne future excise indexation countdown.
- [x] Focused tests: 23 tests passed, read-only October count confirmed 304 rows, public login renders without page errors.
- [ ] Authenticated end-to-end pricing, pagination, CSV and Pipedrive verification. Blocked: managed requester session cannot be minted, user must sign in to preview.