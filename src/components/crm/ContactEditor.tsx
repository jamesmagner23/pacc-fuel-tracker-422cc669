import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { CrmContact } from "@/hooks/useCrm";

type Props = {
  open: boolean;
  customerId: string;
  initial?: Partial<CrmContact> | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ContactEditor({ open, customerId, initial, onClose, onSaved }: Props) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [primary, setPrimary] = useState(false);
  const [dnc, setDnc] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirst(initial?.first_name ?? "");
    setLast(initial?.last_name ?? "");
    setRole(initial?.role ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setPrimary(!!initial?.is_primary);
    setDnc(!!initial?.do_not_contact);
  }, [open, initial]);

  async function save() {
    const payload = {
      customer_id: customerId,
      first_name: first.trim() || null,
      last_name: last.trim() || null,
      role: role.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      is_primary: primary,
      do_not_contact: dnc,
    };
    const op = initial?.id
      ? supabase.from("crm_contacts").update(payload).eq("id", initial.id)
      : supabase.from("crm_contacts").insert(payload);
    const { error } = await op;
    if (error) { toast.error(error.message); return; }
    toast.success("Contact saved");
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface border-surface-border text-foreground max-w-md">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit contact" : "Add contact"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input value={first} onChange={e => setFirst(e.target.value)} className="bg-surface border-surface-border" /></div>
            <div><Label>Last name</Label><Input value={last} onChange={e => setLast(e.target.value)} className="bg-surface border-surface-border" /></div>
          </div>
          <div><Label>Role</Label><Input value={role} onChange={e => setRole(e.target.value)} className="bg-surface border-surface-border" /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-surface border-surface-border" /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-surface border-surface-border" /></div>
          <label className="flex items-center gap-2 text-sm text-foreground"><Checkbox checked={primary} onCheckedChange={(v) => setPrimary(!!v)} /> Primary contact</label>
          <label className="flex items-center gap-2 text-sm text-foreground"><Checkbox checked={dnc} onCheckedChange={(v) => setDnc(!!v)} /> Do not contact</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-surface-border">Cancel</Button>
          <Button onClick={save} style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}