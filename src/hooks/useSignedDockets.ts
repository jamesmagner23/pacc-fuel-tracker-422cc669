import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/requestTimeout";
export const DOCKET_PAGE_SIZE = 25;
export function useSignedDockets(client: number | null, from: string, to: string, page: number, enabled = true) {
  return useQuery({ queryKey: ["signed-dockets-list", client, from, to, page], enabled, retry: 1,
    queryFn: async ({ signal }) => {
      const { data, error, count } = await withTimeout(supabase.rpc("list_signed_dockets", { _client: client ?? undefined, _from: from || undefined, _to: to || undefined }, { count: "exact" })
        .order("docket_date", { ascending: false }).order("recorded_at", { ascending: false }).order("id")
        .range(page * DOCKET_PAGE_SIZE, (page + 1) * DOCKET_PAGE_SIZE - 1).abortSignal(signal));
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
}
export type DocketRow = NonNullable<ReturnType<typeof useSignedDockets>["data"]>["rows"][number];