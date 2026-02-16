import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllTransactions } from "@/hooks/useTransactions";
import { toast } from "sonner";
import { UserPlus, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

interface ClientAccount {
  id: number;
  company_name: string;
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string | null;
}

export default function ClientManagement() {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [formCompany, setFormCompany] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");

  const { data: allTxns = [] } = useAllTransactions();

  const companyNames = useMemo(() => {
    return [...new Set(allTxns.map((t) => t.nombre_cliente1).filter(Boolean))].sort() as string[];
  }, [allTxns]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("client_accounts")
      .select("id, company_name, contact_name, contact_email, contact_phone, is_active, created_at")
      .order("company_name");
    if (error) {
      toast.error("Failed to load clients");
      return;
    }
    setClients(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompany || !formEmail) return;
    setInviting(true);

    try {
      // Call edge function to create user and client account
      const { data, error } = await supabase.functions.invoke("invite-client", {
        body: {
          company_name: formCompany,
          contact_name: formName,
          contact_email: formEmail,
          contact_phone: formPhone,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to invite client");

      toast.success(`Invited ${formCompany}`);
      setShowInvite(false);
      setFormCompany("");
      setFormName("");
      setFormEmail("");
      setFormPhone("");
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite client");
    } finally {
      setInviting(false);
    }
  };

  const toggleActive = async (client: ClientAccount) => {
    const { error } = await supabase
      .from("client_accounts")
      .update({ is_active: !client.is_active })
      .eq("id", client.id);

    if (error) {
      toast.error("Failed to update client");
      return;
    }
    toast.success(`${client.company_name} ${client.is_active ? "deactivated" : "activated"}`);
    fetchClients();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Client Portal</h1>
        <button onClick={() => setShowInvite(!showInvite)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
          <UserPlus className="w-3.5 h-3.5" /> Invite Client
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="glass-card p-5 space-y-3 animate-fade-in">
          <h2 className="text-sm font-semibold">Invite New Client</h2>
          <select value={formCompany} onChange={(e) => setFormCompany(e.target.value)} required className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">Select company...</option>
            {companyNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" placeholder="Contact name" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="email" placeholder="Contact email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input type="tel" placeholder="Phone (optional)" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <button type="submit" disabled={inviting} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Invite
          </button>
        </form>
      )}

      {clients.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No client accounts yet. Invite your first client above.</div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div key={c.id} className="glass-card p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{c.company_name}</div>
                <div className="text-xs text-muted-foreground">{c.contact_email}{c.contact_name ? ` · ${c.contact_name}` : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.is_active ? "bg-[hsl(var(--kpi-up))]/20 text-kpi-up" : "bg-destructive/20 text-destructive"}`}>
                  {c.is_active ? "Active" : "Inactive"}
                </span>
                <button onClick={() => toggleActive(c)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {c.is_active ? <ToggleRight className="w-5 h-5 text-kpi-up" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
