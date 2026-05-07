import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "client" | "driver" | null;

/**
 * Returns the signed-in user's role from `user_roles`. Cached — safe to
 * call from many components on the same page.
 */
export function useUserRole() {
  return useQuery({
    queryKey: ["user-role"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppRole> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) return null;
      return (data?.role as AppRole) || null;
    },
  });
}