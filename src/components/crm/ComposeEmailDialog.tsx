import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fetchLastEmailToAddress, type CrmContact, type CrmCustomer } from "@/hooks/useCrm";

type Tpl = { id: string; name: string; subject: string; html_body: string; text_body: string };

function merge(str: string, vars: Record<string, string>) {
  return (str || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

type Props = {
  open: boolean;
  customer: CrmCustomer;
  contacts: CrmContact[];
  preselectContactId?: string | null;
  onClose: () => void;
  onSent: () => void;
};

export default function ComposeEmailDialog({ open, customer, contacts, preselectContactId, onClose, onSent }: Props) {
  const [contactId, setContactId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [cooldownDays, setCooldownDays] = useState(7);

  useEffect(() => {
    if (!open) return;
    setContactId(preselectContactId || contacts.find(c => c.is_primary)?.id || contacts[0]?.id || "");
    void (async () => {
      const [{ data: tpls }, { data: settings }] = await Promise.all([
        supabase.from("email_templates").select("id,name,subject,html_body,text_body").eq("is_active", true).order("name"),
        supabase.from("crm_settings").select("cooldown_days").eq("id", 1).maybeSingle(),
      ]);
      setTemplates((tpls ?? []) as Tpl[]);
      if (settings?.cooldown_days) setCooldownDays(settings.cooldown_days);
    })();
  }, [open, preselectContactId, contacts]);

  const contact = useMemo(() => contacts.find(c => c.id === contactId) || null, [contacts, contactId]);

  // Cooldown check whenever the selected contact changes
  useEffect(() => {
    if (!open || !contact?.email) { setWarning(null); return; }
    void (async () => {
      const last = await fetchLastEmailToAddress(contact.email!, cooldownDays);
      if (last) {
        const days = Math.max(0, Math.round((Date.now() - new Date(last.occurred_at).getTime()) / 86400_000));
        setWarning(`Heads up: this contact was emailed ${days === 0 ? "today" : `${days}d ago`}${last.subject ? ` — “${last.subject}”` : ""}.`);
      } else {
        setWarning(null);
      }
    })();
  }, [contact, open, cooldownDays]);

  function applyTemplate(tplId: string) {
    setTemplateId(tplId);
    const t = templates.find(x => x.id === tplId);
    if (!t) return;
    const vars: Record<string, string> = {
      "contact.first_name": contact?.first_name ?? "",
      "contact.last_name": contact?.last_name ?? "",
      "customer.name": customer.name,
      "portal_url": "https://paccenergy.com/portal",
    };
    setSubject(merge(t.subject, vars));
    setBody(merge(t.text_body || t.html_body.replace(/<[^>]+>/g, ""), vars));
  }

  async function send() {
    if (!contact?.email) { toast.error("Contact has no email"); return; }
    if (contact.do_not_contact) { toast.error("Contact is marked do-not-contact"); return; }
    if (!subject.trim() || !body.trim()) { toast.error("Subject and body required"); return; }
    setSending(true);
    try {
      const html = body.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
      const { data, error } = await supabase.functions.invoke("send-via-gmail", {
        body: { to: contact.email, subject, html, text: body },
      });
      if (error || !data?.ok) throw new Error(error?.message || data?.error || "Send failed");

      const { data: { user } } = await supabase.auth.getUser();

      // Log into outreach_send_log (admin) — trigger mirrors into crm_activities
      await supabase.from("outreach_send_log").insert({
        channel: "gmail",
        recipient_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || null,
        recipient_email: contact.email,
        organisation: customer.name,
        subject,
        body,
        sent_by: user?.id ?? "",
        gmail_message_id: data.messageId,
        gmail_thread_id: data.threadId,
        send_status: "sent",
        template_id: templateId || null,
      });

      // Belt-and-braces: ensure activity exists even if the trigger conditions weren't met
      await supabase.from("crm_activities").insert({
        customer_id: customer.id,
        contact_id: contact.id,
        user_id: user?.id ?? null,
        channel: "email",
        direction: "outbound",
        subject,
        body_excerpt: body.slice(0, 500),
        gmail_message_id: data.messageId,
        gmail_thread_id: data.threadId,
        outcome: "sent",
      });

      toast.success("Email sent");
      onSent();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface border-surface-border text-foreground max-w-2xl">
        <DialogHeader><DialogTitle>Email — {customer.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>To</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="bg-surface border-surface-border"><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent className="bg-surface border-surface-border text-foreground">
                  {contacts.filter(c => c.email).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}
                      {c.do_not_contact ? " (DNC)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger className="bg-surface border-surface-border"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent className="bg-surface border-surface-border text-foreground">
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {warning && (
            <div className="flex items-start gap-2 p-3 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{warning} Double-check before sending to avoid flooding the client.</span>
            </div>
          )}

          <div><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} className="bg-surface border-surface-border" /></div>
          <div><Label>Body</Label><Textarea value={body} onChange={e => setBody(e.target.value)} rows={10} className="bg-surface border-surface-border" /></div>
          <p className="text-xs text-muted-foreground">Variables: {"{{contact.first_name}} {{customer.name}} {{portal_url}}"}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-surface-border">Cancel</Button>
          <Button onClick={send} disabled={sending} style={{ background: "var(--accent)", color: "var(--accent-foreground, #fff)" }}>
            {sending ? "Sending…" : "Send via Gmail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}