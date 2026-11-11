# Batch 1

- [ ] Add private cron-token authentication without weakening admin authentication.
- [ ] Replace the 15-minute HTTP job with runtime token lookup and 120-second timeout. Blocked: scheduling tools prohibit custom HTTP SQL and cannot configure this unmanaged job.
- [ ] Return non-200 on sync failures and retain sync logging.
- [ ] Show full Melbourne last-success timestamps and warnings after one hour everywhere.
- [ ] Verify authentication, timestamp rules and visible displays, report exact changed files.