import { useEffect, useState } from "react";
import { formatSyncTimestamp, isSyncStale } from "@/lib/syncStatus";

export function useSyncFreshness(timestamp: string | null | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return {
    lastSyncTime: formatSyncTimestamp(timestamp) || null,
    isSyncStale: isSyncStale(timestamp, now),
  };
}