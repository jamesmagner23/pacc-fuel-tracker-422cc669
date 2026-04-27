import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FtcRate {
  id: string;
  equipment_type: string;
  rate_per_litre: number;
  effective_from: string;
  display_order: number;
  notes: string | null;
}

export function useFtcRates() {
  return useQuery({
    queryKey: ["ftc-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ftc_rates")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as FtcRate[];
    },
  });
}