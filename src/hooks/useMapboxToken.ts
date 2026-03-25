import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MAPBOX_PUBLIC_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "pk.eyJ1IjoicGFjY2VuZXJneSIsImEiOiJjbW41Z2p4bTMwYTR4MnFwaXdwNmI5NTJjIn0.KTCnzgBl7seFYFyuplg0yA";

interface MapboxTokenResponse {
  token: string | null;
}

export function useMapboxToken() {
  return useQuery({
    queryKey: ["mapbox-token"],
    queryFn: async () => {
      if (MAPBOX_PUBLIC_TOKEN) return MAPBOX_PUBLIC_TOKEN;

      const { data, error } = await supabase.functions.invoke<MapboxTokenResponse>("get-mapbox-token");
      if (error) throw error;

      return data?.token ?? "";
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
