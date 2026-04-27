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
  ftc_rate_id: string | null;
  manufacturer: string | null;
  model: string | null;
  size: string | null;
  tank_size_litres: number | null;
  colour: string | null;
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
        return { id: item.id };
      } else {
        const { data, error } = await supabase
          .from("plant_items")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return { id: data!.id as string };
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

/**
 * Upload a plant photo to the private `plant-photos` bucket and return its
 * signed URL (valid for ~1 year). Folder convention: <client_account_id>/<filename>
 */
export async function uploadPlantPhoto(
  clientAccountId: number,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${clientAccountId}/${crypto.randomUUID()}.${safeExt}`;
  const { error: upErr } = await supabase.storage
    .from("plant-photos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${safeExt}`,
    });
  if (upErr) throw upErr;
  const { data, error: urlErr } = await supabase.storage
    .from("plant-photos")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (urlErr) throw urlErr;
  return data.signedUrl;
}