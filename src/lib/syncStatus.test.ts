import { describe, expect, it } from "vitest";
import { formatSyncTimestamp, isSyncStale } from "./syncStatus";

describe("sync timestamps", () => {
  it("uses Melbourne summer time and the full date", () => {
    expect(formatSyncTimestamp("2026-11-11T02:21:00Z")).toBe("11 Nov 2026, 1:21 pm");
  });
  it("uses Melbourne winter time", () => {
    expect(formatSyncTimestamp("2026-06-11T02:21:00Z")).toBe("11 June 2026, 12:21 pm");
  });
  it("warns only after one hour", () => {
    const timestamp = "2026-11-11T02:21:00Z";
    const syncedAt = new Date(timestamp).getTime();
    expect(isSyncStale(timestamp, syncedAt + 3_600_000)).toBe(false);
    expect(isSyncStale(timestamp, syncedAt + 3_600_001)).toBe(true);
  });
  it("treats missing successful syncs as stale", () => {
    expect(isSyncStale(null)).toBe(true);
    expect(isSyncStale("invalid")).toBe(true);
  });
});