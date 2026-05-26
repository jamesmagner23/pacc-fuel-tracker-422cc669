import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncLog } from "@/hooks/useTransactions";
import { formatTime } from "@/lib/format";

export function TopSyncPill() {
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

  const label = syncing
    ? "Syncing…"
    : lastSync?.synced_at
      ? `Synced ${formatTime(lastSync.synced_at)}`
      : "Never synced";

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="hidden md:inline-flex items-center gap-2 h-8 px-3 rounded-full bg-muted border border-border hover:bg-card transition-colors disabled:opacity-70"
    >
      {syncing ? (
        <Loader2 className="w-3 h-3 animate-spin text-foreground" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
      )}
      <span className="text-[12px] font-medium text-foreground tabular-nums">{label}</span>
    </button>
  );
}