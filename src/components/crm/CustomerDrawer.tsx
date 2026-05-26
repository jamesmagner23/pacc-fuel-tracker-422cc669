import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Phone, Plus, Pencil, FileText, MessageSquare, Calendar, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useCrmContacts, useCrmActivities, type CrmCustomer } from "@/hooks/useCrm";
import ContactEditor from "./ContactEditor";
import LogActivityDialog from "./LogActivityDialog";
import ComposeEmailDialog from "./ComposeEmailDialog";
import CustomerEditor from "./CustomerEditor";

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const channelIcon = {
  email: Mail, call: Phone, sms: MessageSquare, meeting: Calendar, note: StickyNote,
} as const;

type Props = {
  customer: CrmCustomer | null;
  onClose: () => void;
  onChanged: () => void;
};

export default function CustomerDrawer({ customer, onClose, onChanged }: Props) {
  const { data: contacts, refresh: refreshContacts } = useCrmContacts(customer?.id ?? null);
  const { data: activities, refresh: refreshActivities } = useCrmActivities(customer?.id ?? null);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailContactId, setEmailContactId] = useState<string | null>(null);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);

  if (!customer) return null;

  async function archive() {
    if (!confirm("Archive this customer?")) return;
    await supabase.from("crm_customers").update({ status: "archived" }).eq("id", customer!.id);
    toast.success("Archived");
    onChanged();
    onClose();
  }

  return (
    <Sheet open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="bg-surface border-surface-border text-foreground w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span>{customer.name}</span>
            <Badge variant="outline" className="border-surface-border text-accent">{customer.kind}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex gap-2 mt-3 flex-wrap">
          <Button onClick={() => { setEmailContactId(null); setEmailOpen(true); }} disabled={!contacts.some(c => c.email)} className="h-9" style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}>
            <Mail className="w-3.5 h-3.5 mr-1.5" /> Email
          </Button>
          <Button variant="outline" onClick={() => setLogOpen(true)} className="h-9 border-surface-border"><Plus className="w-3.5 h-3.5 mr-1.5" /> Log activity</Button>
          <Button variant="outline" onClick={() => setEditCustomerOpen(true)} className="h-9 border-surface-border"><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit</Button>
          <Button variant="outline" onClick={archive} className="h-9 border-surface-border text-muted-foreground">Archive</Button>
        </div>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="bg-surface border border-surface-border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 text-sm">
            <Row label="Stage (acq.)" value={customer.acquisition_stage} />
            <Row label="Stage (ret.)" value={customer.retention_stage} />
            <Row label="Source" value={customer.source ?? "—"} />
            <Row label="Industry" value={customer.industry ?? "—"} />
            <Row label="Website" value={customer.website ?? "—"} />
            <Row label="Estimated value" value={customer.estimated_value != null ? `$${Number(customer.estimated_value).toLocaleString()}` : "—"} />
            <Row label="Next follow-up" value={customer.next_follow_up_at ?? "—"} />
            {customer.lost_reason && <Row label="Lost reason" value={customer.lost_reason} />}
            {customer.notes && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Notes</div>
                <div className="bg-surface-raised rounded p-3 whitespace-pre-wrap">{customer.notes}</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="space-y-2">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="border-surface-border" onClick={() => { setEditingContact(null); setContactOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add contact
              </Button>
            </div>
            {contacts.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No contacts yet.</div>}
            {contacts.map(c => (
              <div key={c.id} className="border border-surface-border rounded p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed"}</span>
                    {c.is_primary && <Badge variant="outline" className="border-accent text-accent text-[10px]">Primary</Badge>}
                    {c.do_not_contact && <Badge variant="outline" className="border-red-500/50 text-red-400 text-[10px]">DNC</Badge>}
                  </div>
                  {c.role && <div className="text-xs text-muted-foreground">{c.role}</div>}
                  {c.email && <div className="text-xs text-foreground/80 mt-1">{c.email}</div>}
                  {c.phone && <div className="text-xs text-foreground/80">{c.phone}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  {c.email && !c.do_not_contact && (
                    <Button size="sm" variant="outline" className="h-8 border-surface-border" onClick={() => { setEmailContactId(c.id); setEmailOpen(true); }}>
                      <Mail className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 border-surface-border" onClick={() => { setEditingContact(c); setContactOpen(true); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="activity" className="space-y-2">
            {activities.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No activity yet.</div>}
            {activities.map(a => {
              const Icon = channelIcon[a.channel] ?? FileText;
              return (
                <div key={a.id} className="border border-surface-border rounded p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                    <span className="uppercase tracking-wide">{a.channel}</span>
                    <span>·</span>
                    <span>{fmt(a.occurred_at)}</span>
                    {a.outcome && <Badge variant="outline" className="border-surface-border text-[10px] ml-auto">{a.outcome}</Badge>}
                  </div>
                  {a.subject && <div className="font-medium mt-1 text-sm">{a.subject}</div>}
                  {a.body_excerpt && <div className="text-xs text-foreground/80 mt-1 whitespace-pre-wrap">{a.body_excerpt}</div>}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        <ContactEditor
          open={contactOpen}
          customerId={customer.id}
          initial={editingContact}
          onClose={() => setContactOpen(false)}
          onSaved={refreshContacts}
        />
        <LogActivityDialog
          open={logOpen}
          customerId={customer.id}
          contacts={contacts}
          onClose={() => setLogOpen(false)}
          onSaved={refreshActivities}
        />
        <ComposeEmailDialog
          open={emailOpen}
          customer={customer}
          contacts={contacts}
          preselectContactId={emailContactId}
          onClose={() => setEmailOpen(false)}
          onSent={refreshActivities}
        />
        <CustomerEditor
          open={editCustomerOpen}
          initial={customer}
          onClose={() => setEditCustomerOpen(false)}
          onSaved={onChanged}
        />
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}