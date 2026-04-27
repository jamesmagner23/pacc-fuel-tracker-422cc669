import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { PlantItem } from "@/hooks/usePlantItems";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Unique unmapped placas with the # of deliveries each represents. */
  unmappedPlacas: { placa: string; count: number; litres: number }[];
  plantItems: PlantItem[];
  clientAccountId: number;
  /** Called with a placa when the user wants to create a brand-new plant item for it. */
  onCreateNew: (placa: string) => void;
}

const CREATE_NEW = "__create_new__";
const SKIP = "__skip__";

/**
 * Bulk-map unmapped delivery placas to plant items in one screen.
 *
 * For each unique placa the user can either:
 *   - Pick an existing plant item (we'll set that item's `placa` to this code)
 *   - Choose "Create new equipment" → opens the regular PlantItemModal pre-filled
 *   - Skip
 */
export function BulkMapModal({
  open,
  onOpenChange,
  unmappedPlacas,
  plantItems,
  clientAccountId,
  onCreateNew,
}: Props) {
  const qc = useQueryClient();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Plant items that don't yet have a placa — safest pool to assign into.
  const assignable = useMemo(
    () =>
      plantItems
        .filter((pi) => !(pi.placa || "").trim())
        .sort((a, b) => a.name.localeCompare(b.name)),
    [plantItems]
  );

  const setChoice = (placa: string, value: string) =>
    setChoices((c) => ({ ...c, [placa]: value }));

  const handleSave = async () => {
    const updates = Object.entries(choices).filter(
      ([, v]) => v && v !== SKIP && v !== CREATE_NEW
    );
    if (updates.length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      // Apply each update sequentially so we can surface a clear error.
      for (const [placa, plantItemId] of updates) {
        const { error } = await supabase
          .from("plant_items")
          .update({ placa })
          .eq("id", plantItemId);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["plant-items", clientAccountId] });
      toast({
        title: `Mapped ${updates.length} ${
          updates.length === 1 ? "placa" : "placas"
        }`,
      });
      setChoices({});
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Mapping failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = Object.values(choices).filter(
    (v) => v && v !== SKIP && v !== CREATE_NEW
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Map Unmapped Deliveries</DialogTitle>
        </DialogHeader>

        {unmappedPlacas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to map — every delivery has a matching plant item. 🎉
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              For each unrecognised placa, assign it to an existing plant item
              (we'll save the placa onto that item) or create a brand-new one.
              Items already linked to another placa are hidden — edit those
              individually from the Plant tab.
            </p>
            <div className="rounded-md border border-border divide-y divide-border">
              {unmappedPlacas.map(({ placa, count, litres }) => (
                <div
                  key={placa}
                  className="flex items-center gap-3 p-3 flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-semibold">
                      {placa}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {count} {count === 1 ? "delivery" : "deliveries"} ·{" "}
                      {Math.round(litres).toLocaleString()} L
                    </div>
                  </div>
                  <div className="w-full sm:w-64">
                    <Select
                      value={choices[placa] || ""}
                      onValueChange={(v) => {
                        setChoice(placa, v);
                        if (v === CREATE_NEW) onCreateNew(placa);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose action…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CREATE_NEW}>
                          ＋ Create new equipment…
                        </SelectItem>
                        <SelectItem value={SKIP}>Skip for now</SelectItem>
                        {assignable.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              Assign to existing
                            </div>
                            {assignable.map((pi) => (
                              <SelectItem key={pi.id} value={pi.id}>
                                {pi.name}
                                {pi.equipment_type
                                  ? ` · ${pi.equipment_type}`
                                  : ""}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || pendingCount === 0}
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Map {pendingCount > 0 ? pendingCount : ""}{" "}
                {pendingCount === 1 ? "placa" : "placas"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}