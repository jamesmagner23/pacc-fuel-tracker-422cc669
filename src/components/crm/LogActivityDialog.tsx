import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { CrmContact } from "@/hooks/useCrm";

type Props = {
  open: boolean;
  customerId: string;
  contacts: CrmContact[];
  onClose: () => void;
  onSaved: () => void;
};

export default function LogActivityDialog({ open, customerId, contacts, onClose, onSaved }: Props) {
  const [channel, setChannel] = useState<"call" | "sms" | "meeting" | "note">("call");
  const [contactId, setContactId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState<string>("");

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("crm_activities").insert({
      customer_id: customerId,
      contact_id: contactId || null,
      user_id: user?.id ?? null,
      channel,
      direction: channel === "note" ? "internal" : "outbound",
      subject: subject || null,
      body_excerpt: body || null,
      outcome: outcome || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Logged");
    setSubject(""); setBody(""); setOutcome("");
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface border-surface-border text-foreground max-w-md">
        <DialogHeader><DialogTitle>Log activity</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Type</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
              <SelectTrigger className="bg-surface border-surface-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-surface border-surface-border text-foreground">
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {channel !== "note" && (
            <div>
              <Label>Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="bg-surface border-surface-border"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent className="bg-surface border-surface-border text-foreground">
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} className="bg-surface border-surface-border" /></div>
          <div><Label>Notes</Label><Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} className="bg-surface border-surface-border" /></div>
          <div>
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="bg-surface border-surface-border"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent className="bg-surface border-surface-border text-foreground">
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="no_response">No response</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-surface-border">Cancel</Button>
          <Button onClick={save} style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}