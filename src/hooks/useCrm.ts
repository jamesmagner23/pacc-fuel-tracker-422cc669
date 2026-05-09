import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CrmCustomer = {
  id: string;
  kind: "prospect" | "client";
  client_account_id: number | null;
  name: string;
  website: string | null;
  industry: string | null;
  source: string | null;
  owner_user_id: string | null;
  status: "active" | "archived";
  acquisition_stage: "new" | "contacted" | "quoted" | "won" | "lost";
  retention_stage: "active" | "at_risk" | "churned";
  lost_reason: string | null;
  next_follow_up_at: string | null;
  estimated_value: number | null;
  tags: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmContact = {
  id: string;
  customer_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  do_not_contact: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmActivity = {
  id: string;
  customer_id: string;
  contact_id: string | null;
  user_id: string | null;
  channel: "email" | "call" | "sms" | "meeting" | "note";
  direction: "outbound" | "inbound" | "internal";
  subject: string | null;
  body_excerpt: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  outcome: string | null;
  occurred_at: string;
  created_at: string;
};

export function useCrmCustomers() {
  const [data, setData] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("crm_customers")
      .select("*")
      .eq("status", "active")
      .order("updated_at", { ascending: false });
    if (error) console.error("useCrmCustomers", error);
    setData((rows ?? []) as CrmCustomer[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useCrmContacts(customerId: string | null) {
  const [data, setData] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!customerId) { setData([]); return; }
    setLoading(true);
    const { data: rows } = await supabase
      .from("crm_contacts")
      .select("*")
      .eq("customer_id", customerId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    setData((rows ?? []) as CrmContact[]);
    setLoading(false);
  }, [customerId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useCrmActivities(customerId: string | null) {
  const [data, setData] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!customerId) { setData([]); return; }
    setLoading(true);
    const { data: rows } = await supabase
      .from("crm_activities")
      .select("*")
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    setData((rows ?? []) as CrmActivity[]);
    setLoading(false);
  }, [customerId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, refresh };
}

/** Fetch the most recent email activity for a given email address (any teammate). */
export async function fetchLastEmailToAddress(email: string, withinDays: number) {
  if (!email) return null;
  const since = new Date(Date.now() - withinDays * 86400_000).toISOString();
  const { data } = await supabase
    .from("crm_activities")
    .select("id, occurred_at, subject, user_id, contact_id")
    .eq("channel", "email")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (!data?.length) return null;
  // We don't have the email on the activity row itself, so resolve via contacts
  const contactIds = Array.from(new Set(data.map((r: any) => r.contact_id).filter(Boolean)));
  if (!contactIds.length) return null;
  const { data: contacts } = await supabase
    .from("crm_contacts")
    .select("id, email")
    .in("id", contactIds);
  const matchIds = new Set(
    (contacts ?? [])
      .filter((c: any) => (c.email ?? "").toLowerCase() === email.toLowerCase())
      .map((c: any) => c.id),
  );
  return (data.find((r: any) => r.contact_id && matchIds.has(r.contact_id)) ?? null) as CrmActivity | null;
}