import { supabase } from "@/integrations/supabase/client";

export type SalesActivityStatus =
  | "drafted"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "overridden"
  | "emailed_rate";

export async function logSalesActivity(entry: {
  client_name: string;
  client_email?: string | null;
  litres?: number | null;
  terms_days?: number | null;
  sell_price_per_litre?: number | null;
  buy_price_per_litre?: number | null;
  gp_pct?: number | null;
  status: SalesActivityStatus;
  source?: string;
  quote_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("sales_activity").insert({
      rep_id: session.user.id,
      client_name: entry.client_name || "unknown",
      client_email: entry.client_email ?? null,
      litres: entry.litres ?? null,
      terms_days: entry.terms_days ?? null,
      sell_price_per_litre: entry.sell_price_per_litre ?? null,
      buy_price_per_litre: entry.buy_price_per_litre ?? null,
      gp_pct: entry.gp_pct ?? null,
      status: entry.status,
      source: entry.source ?? null,
      quote_id: entry.quote_id ?? null,
      metadata: (entry.metadata ?? {}) as never,
    });
  } catch {
    // logging must never break the caller
  }
}
