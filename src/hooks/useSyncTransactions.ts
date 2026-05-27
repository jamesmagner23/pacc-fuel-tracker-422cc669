import { useEffect, useRef, useState } from "react";
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

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useSyncTransactions(options: { autoSync?: boolean } = {}) {
  const { autoSync = false } = options;
  const { data: lastSync } = useSyncLog();
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  const handleSync = async (opts: { silent?: boolean } = {}) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-transactions");
      if (error) throw error;

      if (data?.success) {
        const count = Number(data.records_upserted ?? 0);
        if (!opts.silent) {
          toast.success(count > 0 ? `Synced ${count} transactions` : "Data refreshed — no new transactions");
        } else if (count > 0) {
          toast.success(`Auto-synced ${count} new transactions`);
        }
        REFRESH_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      } else {
        if (!opts.silent) toast.error(data?.error || "Sync failed");
      }
    } catch (err: any) {
      if (!opts.silent) toast.error(err.message || "Sync failed");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!autoSync) return;
    const tick = () => {
      if (document.visibilityState === "visible") {
        handleSync({ silent: true });
      }
    };
    const interval = setInterval(tick, AUTO_SYNC_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync]);

  const lastSyncTime = lastSync?.synced_at ? formatTime(lastSync.synced_at) : null;
  const syncedLabel = lastSyncTime ? `Synced ${lastSyncTime}` : "Never synced";

  return { syncing, handleSync, lastSync, lastSyncTime, syncedLabel };
}