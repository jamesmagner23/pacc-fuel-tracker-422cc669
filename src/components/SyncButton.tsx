import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function SyncButton() {
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

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync Now"}</span>
    </button>
  );
}
