import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpsertPlantItem, type PlantItem } from "@/hooks/usePlantItems";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientAccountId: number;
  initial?: Partial<PlantItem> | null;
}

export function PlantItemModal({ open, onOpenChange, clientAccountId, initial }: Props) {
  const upsert = useUpsertPlantItem();
  const [form, setForm] = useState({
    id: "",
    placa: "",
    name: "",
    equipment_type: "",
    serial_number: "",
    description: "",
    photo_url: "",
    service_notes: "",
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
      });
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await upsert.mutateAsync({
      id: form.id || undefined,
      client_account_id: clientAccountId,
      placa: form.placa || null,
      name: form.name,
      equipment_type: form.equipment_type || null,
      serial_number: form.serial_number || null,
      description: form.description || null,
      photo_url: form.photo_url || null,
      service_notes: form.service_notes || null,
    } as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
              <Label>Plate / Asset ID</Label>
              <Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} placeholder="ABC123" />
            </div>
            <div>
              <Label>Type</Label>
              <Input value={form.equipment_type} onChange={(e) => setForm({ ...form, equipment_type: e.target.value })} placeholder="Excavator" />
            </div>
          </div>
          <div>
            <Label>Serial Number</Label>
            <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
          </div>
          <div>
            <Label>Photo URL</Label>
            <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Service Notes</Label>
            <Textarea rows={2} value={form.service_notes} onChange={(e) => setForm({ ...form, service_notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || upsert.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}