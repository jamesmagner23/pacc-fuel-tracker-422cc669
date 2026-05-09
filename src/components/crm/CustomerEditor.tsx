import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { CrmCustomer } from "@/hooks/useCrm";

type Props = {
  open: boolean;
  initial?: Partial<CrmCustomer> | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function CustomerEditor({ open, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [source, setSource] = useState("");
  const [estVal, setEstVal] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setWebsite(initial?.website ?? "");
    setIndustry(initial?.industry ?? "");
    setSource(initial?.source ?? "");
    setEstVal(initial?.estimated_value ? String(initial.estimated_value) : "");
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  async function save() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      name: name.trim(),
      website: website.trim() || null,
      industry: industry.trim() || null,
      source: source.trim() || null,
      estimated_value: estVal ? Number(estVal) : null,
      notes: notes.trim() || null,
    };
    if (initial?.id) {
      const { error } = await supabase.from("crm_customers").update(payload).eq("id", initial.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("crm_customers").insert({
        ...payload,
        kind: initial?.kind ?? "prospect",
        owner_user_id: user?.id ?? null,
        created_by: user?.id ?? null,
      });
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success("Saved");
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface border-surface-border text-foreground max-w-lg">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit customer" : "New customer / lead"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Organisation name</Label><Input value={name} onChange={e => setName(e.target.value)} className="bg-surface border-surface-border" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Website</Label><Input value={website} onChange={e => setWebsite(e.target.value)} className="bg-surface border-surface-border" /></div>
            <div><Label>Industry</Label><Input value={industry} onChange={e => setIndustry(e.target.value)} className="bg-surface border-surface-border" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Source</Label><Input value={source} onChange={e => setSource(e.target.value)} placeholder="referral / cold / inbound" className="bg-surface border-surface-border" /></div>
            <div><Label>Estimated value ($)</Label><Input type="number" value={estVal} onChange={e => setEstVal(e.target.value)} className="bg-surface border-surface-border" /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="bg-surface border-surface-border" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-surface-border">Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ background: "var(--accent)", color: "var(--accent-foreground, #fff)" }}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}