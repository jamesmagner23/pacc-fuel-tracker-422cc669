import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpsertPlantItem, uploadPlantPhoto, type PlantItem } from "@/hooks/usePlantItems";
import { useFtcRates } from "@/hooks/useFtcRates";
import {
  usePlantTags,
  usePlantItemTagLinks,
  useSavePlantItemTags,
} from "@/hooks/usePlantTags";
import { TagInput } from "@/components/customer/TagInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Upload, Loader2, X } from "lucide-react";
import { PlantAssignmentTimeline } from "@/components/customer/PlantAssignmentTimeline";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientAccountId: number;
  initial?: Partial<PlantItem> | null;
}

export function PlantItemModal({ open, onOpenChange, clientAccountId, initial }: Props) {
  const upsert = useUpsertPlantItem();
  const saveTags = useSavePlantItemTags();
  const { data: ftcRates = [] } = useFtcRates();
  const { data: allTags = [] } = usePlantTags(clientAccountId);
  const { data: tagLinks = [] } = usePlantItemTagLinks(clientAccountId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [form, setForm] = useState({
    id: "",
    placa: "",
    name: "",
    equipment_type: "",
    serial_number: "",
    description: "",
    photo_url: "",
    service_notes: "",
    ftc_rate_id: "",
    manufacturer: "",
    model: "",
    size: "",
    tank_size_litres: "",
    colour: "",
    display_asset_id: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        id: initial?.id || "",
        placa: initial?.placa || "",
        name: initial?.name || "",
        equipment_type: initial?.equipment_type || "",
        serial_number: initial?.serial_number || "",
        description: initial?.description || "",
        photo_url: initial?.photo_url || "",
        service_notes: initial?.service_notes || "",
        ftc_rate_id: (initial as any)?.ftc_rate_id || "",
        manufacturer: (initial as any)?.manufacturer || "",
        model: (initial as any)?.model || "",
        size: (initial as any)?.size || "",
        tank_size_litres:
          initial?.tank_size_litres != null ? String(initial.tank_size_litres) : "",
        colour: (initial as any)?.colour || "",
        display_asset_id: (initial as any)?.display_asset_id || "",
      });
      // Hydrate tags for this item from existing links
      if (initial?.id) {
        const tagIdsForItem = new Set(
          tagLinks.filter((l) => l.plant_item_id === initial.id).map((l) => l.tag_id)
        );
        setTags(
          allTags.filter((t) => tagIdsForItem.has(t.id)).map((t) => t.name)
        );
      } else {
        setTags([]);
      }
    }
  }, [open, initial, tagLinks, allTags]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPlantPhoto(clientAccountId, file);
      setForm((f) => ({ ...f, photo_url: url }));
      toast({ title: "Photo uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const tank = form.tank_size_litres.trim();
    const tankNum = tank === "" ? null : Number(tank);
    if (tank !== "" && (!Number.isFinite(tankNum) || tankNum! < 0)) {
      toast({ title: "Invalid tank size", description: "Must be a positive number.", variant: "destructive" });
      return;
    }
    const result = await upsert.mutateAsync({
      id: form.id || undefined,
      client_account_id: clientAccountId,
      placa: form.placa || null,
      name: form.name,
      equipment_type: form.equipment_type || null,
      serial_number: form.serial_number || null,
      description: form.description || null,
      photo_url: form.photo_url || null,
      service_notes: form.service_notes || null,
      ftc_rate_id: form.ftc_rate_id || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      size: form.size || null,
      tank_size_litres: tankNum,
      colour: form.colour || null,
      display_asset_id: form.display_asset_id || null,
    } as any);
    if (result?.id) {
      try {
        await saveTags.mutateAsync({
          plantItemId: result.id,
          clientAccountId,
          tagNames: tags,
        });
      } catch {
        /* toast handled inside the hook */
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. CAT 320 Excavator" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>SpeedSol Rego (read-only)</Label>
              <Input
                value={form.placa}
                onChange={(e) => setForm({ ...form, placa: e.target.value })}
                placeholder="ABC123"
                disabled={!!initial?.placa}
                className={initial?.placa ? "opacity-70" : ""}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Linked to delivery records — don't change.</p>
            </div>
            <div>
              <Label>Type</Label>
              <Input value={form.equipment_type} onChange={(e) => setForm({ ...form, equipment_type: e.target.value })} placeholder="Excavator" />
            </div>
          </div>
          <div>
            <Label>Display Asset ID</Label>
            <Input
              value={form.display_asset_id}
              onChange={(e) => setForm({ ...form, display_asset_id: e.target.value })}
              placeholder="e.g. ISGEN2"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Your internal asset code shown in the customer portal. Doesn't affect SpeedSol data.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Manufacturer</Label>
              <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Caterpillar" />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="320 GC" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Size</Label>
              <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="20t" />
            </div>
            <div>
              <Label>Tank size (L)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={form.tank_size_litres}
                onChange={(e) => setForm({ ...form, tank_size_litres: e.target.value })}
                placeholder="400"
              />
            </div>
            <div>
              <Label>Colour</Label>
              <Input value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} placeholder="Yellow" />
            </div>
          </div>
          <div>
            <Label>Serial Number</Label>
            <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
          </div>
          <div>
            <Label>Photo</Label>
            <div className="flex items-start gap-3">
              {form.photo_url ? (
                <div className="relative shrink-0">
                  <img
                    src={form.photo_url}
                    alt="Equipment"
                    className="w-20 h-20 rounded-md object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, photo_url: "" })}
                    className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 hover:bg-muted"
                    aria-label="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5 mr-1.5" /> {form.photo_url ? "Replace photo" : "Upload photo"}</>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground">JPG / PNG / WebP, max 10 MB.</p>
              </div>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Service Notes</Label>
            <Textarea rows={2} value={form.service_notes} onChange={(e) => setForm({ ...form, service_notes: e.target.value })} />
          </div>
          <div>
            <Label>Tags</Label>
            <TagInput
              value={tags}
              onChange={setTags}
              suggestions={allTags.map((t) => t.name)}
              placeholder="e.g. excavator, night-shift, site-42"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Free-form labels for grouping and filtering. Press Enter or comma to add. Existing tags appear as suggestions.
            </p>
          </div>
          <div>
            <Label>Fuel Tax Credit Category</Label>
            <Select
              value={form.ftc_rate_id || "none"}
              onValueChange={(v) => setForm({ ...form, ftc_rate_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select FTC category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not eligible / unset —</SelectItem>
                {ftcRates.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.equipment_type} — {(Number(r.rate_per_litre) * 100).toFixed(1)}c/L
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Used to calculate claimable fuel tax credits from delivered litres.
            </p>
          </div>
          {form.id && (
            <div className="border-t border-border pt-4">
              <Label className="mb-2 block">Project assignment history</Label>
              <PlantAssignmentTimeline plantItemId={form.id} clientAccountId={clientAccountId} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || upsert.isPending || uploading}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}