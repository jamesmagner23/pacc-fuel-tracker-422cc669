import { RefreshCw } from "lucide-react";
import { useSyncTransactions } from "@/hooks/useSyncTransactions";

export function SyncButton() {
  const { syncing, handleSync } = useSyncTransactions();

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 20,
        background: "var(--primary)",
        color: "var(--primary-foreground)",
        fontWeight: 600,
        border: "none",
        cursor: syncing ? "not-allowed" : "pointer",
        opacity: syncing ? 0.7 : 1,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!syncing) (e.currentTarget as HTMLElement).style.background = "var(--primary)";
      }}
      onMouseLeave={(e) => {
        if (!syncing) (e.currentTarget as HTMLElement).style.background = "var(--primary)";
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
