import { Clock } from "lucide-react";
import { useSyncLog } from "@/hooks/useTransactions";
import { formatDistanceToNow } from "date-fns";

export function SyncStatus() {
  const { data: lastSync } = useSyncLog();

  const isRecent =
    lastSync?.synced_at &&
    lastSync.status === "success" &&
    new Date().getTime() - new Date(lastSync.synced_at).getTime() < 30 * 60 * 1000;

  const timeAgo = lastSync?.synced_at
    ? formatDistanceToNow(new Date(lastSync.synced_at), { addSuffix: true })
    : null;

  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          lastSync
            ? isRecent
              ? "bg-[hsl(var(--kpi-up))]"
              : "bg-[hsl(var(--kpi-down))]"
            : "bg-muted-foreground"
        }`}
      />
      <Clock className="w-3 h-3" />
      <span>{timeAgo ? `Last synced: ${timeAgo}` : "Never synced"}</span>
    </div>
  );
}
