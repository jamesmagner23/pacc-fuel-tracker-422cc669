import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a SpeedSol customer name (`nombre_cliente1`) to a `client_accounts.id`.
 * Matches against `speedsol_name`, `speedsol_names[]`, or `company_name` (case-insensitive trim).
 * Returns null if no match — caller can call `useEnsureClientAccount` to create one.
 */
export function useClientAccountByName(name: string | null | undefined) {
  return useQuery({
    queryKey: ["client-account-by-name", name],
    enabled: !!name,
    queryFn: async () => {
      const trimmed = (name || "").trim();
      if (!trimmed) return null;
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, speedsol_name, speedsol_names");
      if (error) throw error;
      const lower = trimmed.toLowerCase();
      const match = (data || []).find((a: any) => {
        if ((a.speedsol_name || "").trim().toLowerCase() === lower) return true;
        if ((a.company_name || "").trim().toLowerCase() === lower) return true;
        const arr: string[] = Array.isArray(a.speedsol_names) ? a.speedsol_names : [];
        return arr.some((s) => (s || "").trim().toLowerCase() === lower);
      });
      return match ? { id: match.id as number, company_name: match.company_name as string } : null;
    },
  });
}

/**
 * Ensure a `client_accounts` row exists for the given SpeedSol name.
 * If missing, creates a minimal record so a `client_profiles` row can be attached.
 */
export function useEnsureClientAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (speedsolName: string): Promise<number> => {
      const trimmed = speedsolName.trim();
      // Re-check before creating
      const { data: existing } = await supabase
        .from("client_accounts")
        .select("id, speedsol_name, speedsol_names, company_name");
      const lower = trimmed.toLowerCase();
      const match = (existing || []).find((a: any) => {
        if ((a.speedsol_name || "").trim().toLowerCase() === lower) return true;
        if ((a.company_name || "").trim().toLowerCase() === lower) return true;
        const arr: string[] = Array.isArray(a.speedsol_names) ? a.speedsol_names : [];
        return arr.some((s) => (s || "").trim().toLowerCase() === lower);
      });
      if (match) return match.id as number;

      const { data, error } = await supabase
        .from("client_accounts")
        .insert({
          company_name: trimmed,
          contact_email: `unknown+${Date.now()}@placeholder.local`,
          speedsol_name: trimmed,
          speedsol_names: [trimmed],
        })
        .select("id")
        .single();
      if (error) throw error;
      return data!.id as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-account-by-name"] });
    },
  });
}