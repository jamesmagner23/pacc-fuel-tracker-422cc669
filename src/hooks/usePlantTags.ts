import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PlantTag {
  id: string;
  client_account_id: number;
  name: string;
  colour: string | null;
}

export interface PlantItemTag {
  plant_item_id: string;
  tag_id: string;
}

/** All tags defined for a client (the reusable library). */
export function usePlantTags(clientAccountId: number | null | undefined) {
  return useQuery({
    queryKey: ["plant-tags", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_tags")
        .select("*")
        .eq("client_account_id", clientAccountId!)
        .order("name");
      if (error) throw error;
      return (data || []) as PlantTag[];
    },
  });
}

/** All plant_item ↔ tag links for a client. */
export function usePlantItemTagLinks(clientAccountId: number | null | undefined) {
  return useQuery({
    queryKey: ["plant-item-tags", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () => {
      // Pull links via plant_items to scope to this client.
      const { data: items, error: e1 } = await supabase
        .from("plant_items")
        .select("id")
        .eq("client_account_id", clientAccountId!);
      if (e1) throw e1;
      const ids = (items || []).map((i) => i.id);
      if (ids.length === 0) return [] as PlantItemTag[];
      const { data, error } = await supabase
        .from("plant_item_tags")
        .select("plant_item_id, tag_id")
        .in("plant_item_id", ids);
      if (error) throw error;
      return (data || []) as PlantItemTag[];
    },
  });
}

/**
 * Save the full set of tags on a plant item.
 * Creates any new tag names that don't exist yet, then replaces the join rows
 * for this item to match `tagNames` exactly.
 */
export function useSavePlantItemTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      plantItemId: string;
      clientAccountId: number;
      tagNames: string[];
    }) => {
      const cleaned = Array.from(
        new Set(
          args.tagNames
            .map((t) => t.trim())
            .filter((t) => t.length > 0 && t.length <= 40)
        )
      );

      // Fetch existing tags for this client
      const { data: existing, error: e1 } = await supabase
        .from("plant_tags")
        .select("id, name")
        .eq("client_account_id", args.clientAccountId);
      if (e1) throw e1;

      const byName = new Map(
        (existing || []).map((t) => [t.name.toLowerCase(), t.id])
      );
      const toCreate = cleaned.filter((n) => !byName.has(n.toLowerCase()));

      if (toCreate.length > 0) {
        const { data: created, error: e2 } = await supabase
          .from("plant_tags")
          .insert(
            toCreate.map((name) => ({
              client_account_id: args.clientAccountId,
              name,
            }))
          )
          .select("id, name");
        if (e2) throw e2;
        (created || []).forEach((t) => byName.set(t.name.toLowerCase(), t.id));
      }

      const targetIds = cleaned
        .map((n) => byName.get(n.toLowerCase()))
        .filter((id): id is string => !!id);

      // Replace join rows for this item
      const { error: eDel } = await supabase
        .from("plant_item_tags")
        .delete()
        .eq("plant_item_id", args.plantItemId);
      if (eDel) throw eDel;

      if (targetIds.length > 0) {
        const { error: eIns } = await supabase
          .from("plant_item_tags")
          .insert(
            targetIds.map((tag_id) => ({
              plant_item_id: args.plantItemId,
              tag_id,
            }))
          );
        if (eIns) throw eIns;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["plant-tags", vars.clientAccountId] });
      qc.invalidateQueries({
        queryKey: ["plant-item-tags", vars.clientAccountId],
      });
    },
    onError: (e: any) =>
      toast({
        title: "Tag save failed",
        description: e.message,
        variant: "destructive",
      }),
  });
}
