import { Clock } from "lucide-react";
import { useSyncLog } from "@/hooks/useTransactions";
import { useSyncFreshness } from "@/hooks/useSyncFreshness";

export function SyncStatus() {
  const { data: lastSync } = useSyncLog();

  const { lastSyncTime, isSyncStale } = useSyncFreshness(lastSync?.synced_at);

  return (
    <div className={`flex items-center gap-1.5 text-[10px] ${isSyncStale ? "text-warning" : "text-muted-foreground"}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isSyncStale ? "bg-warning" : "bg-accent"
        }`}
      />
      <Clock className="w-3 h-3" />
      <span>{lastSyncTime ? `Last synced: ${lastSyncTime}` : "Never synced"}</span>
    </div>
  );
}
