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

# Batch 3

- [x] URL-driven staff and portal tabs with history and legacy portal redirects.
- [x] Server customer summaries, indexes, paginated lightweight combined docket list.
- [x] Private signed docket uploads, own-client reads and signed URL viewing.
- [x] Separate confirmed docket Delete action, preserving existing records.
- [x] Mobile tab strips/grid, visible Sync now, actual admin user emails, station label, All sales filter.
- [x] Focused tests, browser checks and changed-file/migration list.
- [ ] Authenticated upload/view/download, own-client isolation and live list timing. Blocked: requester has no mintable preview session, sign-in required. No existing records were changed during testing.

# Batch 4

- [x] Calculated customer summary revenue and missing rates, using the shared authenticated pricer.
- [x] Public metadata, legal pages, nullable quote fields, hidden unsafe demo buttons, testimonial spelling and renewable/critical-power section.
- [x] Public unknown routes with noindex, sitemap and lazy page/layout loading.
- [x] 15 focused tests, public desktop/mobile browser flows, intercepted form payload, no existing record changes, latest build OK and invalid summary credentials rejected.
- [x] Changed-file and SQL list reported.
- [ ] Signed-in customer revenue and unknown-route verification. Blocked: requesting user has no mintable preview account/session.
- [ ] After-change production entry gzip measurement. Blocked: harness does not expose generated assets or execute the size-report hook, remote preview returns 401. Published baseline: 1,253,245 gzip bytes. Production size reporting is configured for the next full build.

# Batch 5

- [x] Update confirmed public business details, phone links, legal copy and portal availability, without database or stored data changes.
- [x] Verify legal pages, structured business details and public phone links, including desktop/mobile public layouts.
