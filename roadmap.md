# Batch 1

- [x] Add private cron-token authentication without weakening admin authentication.
- [ ] Replace the 15-minute HTTP job with runtime token lookup and 120-second timeout. Blocked: scheduling tools prohibit custom HTTP SQL and cannot configure this unmanaged job.
- [x] Return non-200 on sync failures and retain sync logging.
- [x] Show full Melbourne last-success timestamps and warnings after one hour everywhere.
- [x] Verify authentication and timestamp rules: 12 tests passed and deployed invalid credentials return 401.
- [ ] Authenticated display verification. Blocked: no matching managed session for the requesting user, preview sign-in required.
- [ ] Scheduled end-to-end verification. Blocked: custom HTTP job modification unavailable, and running the existing upsert would modify transactions contrary to the stated data-safety rule.