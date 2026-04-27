import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ClientProfile {
  id: string;
  client_account_id: number;
  legal_business_name: string | null;
  abn: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_suburb: string | null;
  billing_state: string | null;
  billing_postcode: string | null;
  billing_country: string | null;
  website: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  ops_contact_name: string | null;
  ops_contact_email: string | null;
  ops_contact_phone: string | null;
  accounts_contact_name: string | null;
  accounts_contact_email: string | null;
  accounts_contact_phone: string | null;
  site_contact_name: string | null;
  site_contact_email: string | null;
  site_contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

// Fields the client is allowed to edit. Admin-only fields are excluded.
export const CLIENT_EDITABLE_FIELDS = [
  "website",
  "primary_contact_name",
  "primary_contact_email",
  "primary_contact_phone",
  "ops_contact_name",
  "ops_contact_email",
  "ops_contact_phone",
  "accounts_contact_name",
  "accounts_contact_email",
  "accounts_contact_phone",
  "site_contact_name",
  "site_contact_email",
  "site_contact_phone",
] as const;

export function useClientProfile(clientAccountId: number | null | undefined) {
  return useQuery({
    queryKey: ["client-profile", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("client_account_id", clientAccountId!)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as ClientProfile | null;
    },
  });
}

export function useUpsertClientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<ClientProfile> & { client_account_id: number }
    ) => {
      // Try update first; if no row exists, insert.
      const { data: existing } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("client_account_id", input.client_account_id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("client_profiles")
          .update(input)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_profiles").insert(input);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["client-profile", vars.client_account_id] });
      toast({ title: "Profile saved" });
    },
    onError: (e: any) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}
