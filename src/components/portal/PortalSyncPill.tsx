import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { Loader2, RefreshCcw } from "lucide-react";

/**
 * Client-portal version of the admin TopSyncPill. Clients can't trigger a
 * SCA Web sync (that's an admin action), so this just refreshes their cached
 * data and shows a live indicator while react-query is fetching.
 */
export function PortalSyncPill() {
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["customer-transactions-all"] }) > 0;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["customer-transactions-all"] });
    qc.invalidateQueries({ queryKey: ["delivery-requests"] });
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={fetching}
      className="hidden md:inline-flex items-center gap-2 h-8 px-3 rounded-full bg-muted border border-border hover:bg-card transition-colors disabled:opacity-70"
    >
      {fetching ? (
        <Loader2 className="w-3 h-3 animate-spin text-foreground" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
      )}
      <span className="text-[12px] font-medium text-foreground">
        {fetching ? "Refreshing…" : "Live"}
      </span>
      {!fetching && <RefreshCcw className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}