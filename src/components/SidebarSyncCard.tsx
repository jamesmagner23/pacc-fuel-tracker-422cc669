import { RefreshCcw } from "lucide-react";
import { useSyncTransactions } from "@/hooks/useSyncTransactions";

export function SidebarSyncCard() {
  const { syncing, handleSync, syncedLabel } = useSyncTransactions();

  return (
    <div className="p-3 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground">
          Live
        </span>
      </div>
      <div className="text-[12px] text-muted-foreground">{syncedLabel}</div>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:underline w-fit disabled:opacity-60"
      >
        <RefreshCcw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}