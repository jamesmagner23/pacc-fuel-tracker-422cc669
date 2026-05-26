import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncLog } from "@/hooks/useTransactions";
import { formatTime } from "@/lib/format";

export function SidebarSyncCard() {
  const { data: lastSync } = useSyncLog();
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-transactions");
      if (error) throw error;
      if (data?.success) {
        toast.success(`Synced ${data.records_upserted} transactions`);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions-prev"] });
        queryClient.invalidateQueries({ queryKey: ["transactions-all"] });
        queryClient.invalidateQueries({ queryKey: ["sync-log"] });
      } else {
        toast.error(data?.error || "Sync failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const syncedLabel = lastSync?.synced_at ? `Synced ${formatTime(lastSync.synced_at)}` : "Never synced";

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