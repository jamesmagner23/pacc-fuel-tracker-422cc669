import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TruckPing {
  driver_user_id: string;
  driver_name: string | null;
  lat: number;
  lng: number;
  recorded_at: string;
}

/**
 * Returns the most recent driver location ping across all drivers, plus
 * realtime updates. We surface a single truck (the latest one) since the
 * fleet currently runs one truck at a time.
 */
export function useLatestTruckLocation() {
  const qc = useQueryClient();

  const query = useQuery<TruckPing | null>({
    queryKey: ["latest-truck-location"],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_locations")
        .select("driver_user_id, latitude, longitude, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;

      let driver_name: string | null = null;
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("full_name")
        .eq("user_id", data.driver_user_id)
        .maybeSingle();
      driver_name = roleRow?.full_name ?? null;

      return {
        driver_user_id: data.driver_user_id,
        driver_name,
        lat: Number(data.latitude),
        lng: Number(data.longitude),
        recorded_at: data.recorded_at,
      };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("driver_locations_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "driver_locations" },
        () => {
          qc.invalidateQueries({ queryKey: ["latest-truck-location"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}