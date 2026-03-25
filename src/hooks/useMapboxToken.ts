import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MapboxTokenResponse {
  token: string | null;
}

export function useMapboxToken() {
  return useQuery({
    queryKey: ["mapbox-token"],
    queryFn: async () => {
      const buildToken = import.meta.env.VITE_MAPBOX_TOKEN;
      if (buildToken) return buildToken;

      const { data, error } = await supabase.functions.invoke<MapboxTokenResponse>("get-mapbox-token");
      if (error) throw error;

      return data?.token ?? "";
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
