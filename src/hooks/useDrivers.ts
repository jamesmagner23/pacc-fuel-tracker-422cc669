import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DriverUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export function useDrivers() {
  return useQuery({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, full_name, email")
        .eq("role", "driver")
        .order("full_name");
      if (error) throw error;
      return (data || []) as DriverUser[];
    },
  });
}