import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, subMonths, format } from "date-fns";
import type { PortalDateRange } from "@/components/PortalLayout";

function getPortalDateRange(range: PortalDateRange): { start: string; end: string } {
  const today = new Date();
  const endStr = format(today, "yyyy-MM-dd");
  let start: Date;

  switch (range) {
    case "This Week":
      start = subDays(today, 7);
      break;
    case "This Quarter":
      start = subMonths(today, 3);
      break;
    case "This Month":
    default:
      start = subDays(today, 30);
      break;
  }

  return { start: format(start, "yyyy-MM-dd"), end: endStr };
}

export function useClientTransactions(range: PortalDateRange) {
  const { start, end } = getPortalDateRange(range);

  return useQuery({
    queryKey: ["client-transactions", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, fecha, date, ciudad, cantidad, cantidad_neta, placa, producto, estacion")
        .gte("date", start)
        .lte("date", end)
        .order("fecha", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}
