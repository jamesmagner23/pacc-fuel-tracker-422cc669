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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 20,
        background: "var(--accent)",
        color: "var(--primary-foreground)",
        fontWeight: 600,
        border: "none",
        cursor: syncing ? "not-allowed" : "pointer",
        opacity: syncing ? 0.7 : 1,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!syncing) (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)";
      }}
      onMouseLeave={(e) => {
        if (!syncing) (e.currentTarget as HTMLElement).style.background = "var(--accent)";
      }}
    >
      <span className="flex md:hidden" style={{ padding: "7px 10px", alignItems: "center" }}>
        <RefreshCw style={{ width: 13, height: 13 }} className={syncing ? "animate-spin" : ""} />
      </span>
      <span
        className="hidden md:flex"
        style={{ padding: "7px 16px", alignItems: "center", gap: 6, fontSize: 12, letterSpacing: "0.01em" }}
      >
        <RefreshCw style={{ width: 11, height: 11 }} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing..." : "Sync Now"}
      </span>
    </button>
  );
}
