import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PlantItem {
  id: string;
  client_account_id: number;
  placa: string | null;
  name: string;
  equipment_type: string | null;
  serial_number: string | null;
  description: string | null;
  photo_url: string | null;
  service_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePlantItems(clientAccountId: number | null | undefined) {
  return useQuery({
    queryKey: ["plant-items", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_items")
        .select("*")
        .eq("client_account_id", clientAccountId!)
        .order("name");
      if (error) throw error;
      return (data || []) as PlantItem[];
    },
  });
}

export function useUpsertPlantItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<PlantItem> & { client_account_id: number; name: string }) => {
      const payload: any = { ...item };
      if (item.id) {
        const { error } = await supabase.from("plant_items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plant_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["plant-items", vars.client_account_id] });
      toast({ title: "Equipment saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}

export function useDeletePlantItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; client_account_id: number }) => {
      const { error } = await supabase.from("plant_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["plant-items", vars.client_account_id] });
      toast({ title: "Equipment removed" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
}