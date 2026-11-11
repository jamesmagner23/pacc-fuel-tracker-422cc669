export const SYNC_STALE_AFTER_MS = 60 * 60 * 1000;

export function isSyncStale(timestamp: string | null | undefined, now = Date.now()): boolean {
  if (!timestamp) return true;
  const syncedAt = new Date(timestamp).getTime();
  return !Number.isFinite(syncedAt) || now - syncedAt > SYNC_STALE_AFTER_MS;
}

export function formatSyncTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp || !Number.isFinite(new Date(timestamp).getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")} ${part("dayPeriod").toLowerCase()}`;
}