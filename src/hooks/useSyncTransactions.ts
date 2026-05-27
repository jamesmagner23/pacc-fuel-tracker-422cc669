import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSyncLog } from "@/hooks/useTransactions";
import { formatTime } from "@/lib/format";

const REFRESH_QUERY_KEYS = [
  "transactions",
  "transactions-prev",
  "transactions-all",
  "customer-transactions-all",
  "sync-log",
  "buy-prices",
];

export function useSyncTransactions() {
  const { data: lastSync } = useSyncLog();
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-transactions");
      if (error) throw error;

      if (data?.success) {
        const count = Number(data.records_upserted ?? 0);
        toast.success(count > 0 ? `Synced ${count} transactions` : "Data refreshed — no new transactions");
        REFRESH_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      } else {
        toast.error(data?.error || "Sync failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const lastSyncTime = lastSync?.synced_at ? formatTime(lastSync.synced_at) : null;
  const syncedLabel = lastSyncTime ? `Synced ${lastSyncTime}` : "Never synced";

  return { syncing, handleSync, lastSync, lastSyncTime, syncedLabel };
}