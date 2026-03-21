
CREATE TABLE public.customer_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id bigint REFERENCES public.client_accounts(id) ON DELETE CASCADE NOT NULL,
  margin_percent numeric NOT NULL DEFAULT 10,
  payment_terms text NOT NULL DEFAULT '30 days',
  weekly_volume_tier text NOT NULL DEFAULT '0-500',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (client_account_id)
);

ALTER TABLE public.customer_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on customer_pricing" ON public.customer_pricing FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert on customer_pricing" ON public.customer_pricing FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update on customer_pricing" ON public.customer_pricing FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete on customer_pricing" ON public.customer_pricing FOR DELETE TO public USING (true);
