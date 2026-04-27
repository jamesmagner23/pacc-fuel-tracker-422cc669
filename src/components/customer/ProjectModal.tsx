import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpsertProject, type Project } from "@/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientAccountId: number;
  initial?: Partial<Project> | null;
}

export function ProjectModal({ open, onOpenChange, clientAccountId, initial }: Props) {
  const upsert = useUpsertProject();
  const [form, setForm] = useState({
    id: "",
    name: "",
    site_address: "",
    start_date: "",
    end_date: "",
    status: "active",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        id: initial?.id || "",
        name: initial?.name || "",
        site_address: initial?.site_address || "",
        start_date: initial?.start_date || "",
        end_date: initial?.end_date || "",
        status: initial?.status || "active",
        notes: initial?.notes || "",
      });
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await upsert.mutateAsync({
      id: form.id || undefined,
      client_account_id: clientAccountId,
      name: form.name,
      site_address: form.site_address || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      notes: form.notes || null,
    } as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Project name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Westgate Tunnel Stage 2" />
          </div>
          <div>
            <Label>Site address</Label>
            <Input value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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