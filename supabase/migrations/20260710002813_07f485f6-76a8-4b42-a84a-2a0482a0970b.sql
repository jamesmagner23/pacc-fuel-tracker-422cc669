
-- sales_activity: log every quote/rate action from the Sales section
CREATE TABLE public.sales_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  litres NUMERIC,
  terms_days INTEGER,
  sell_price_per_litre NUMERIC,
  buy_price_per_litre NUMERIC,
  gp_pct NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('drafted','sent','accepted','rejected','expired','overridden','emailed_rate')),
  source TEXT,  -- 'price_a_drop' | 'quote_builder' | etc
  quote_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sales_activity TO authenticated;
GRANT ALL ON public.sales_activity TO service_role;

ALTER TABLE public.sales_activity ENABLE ROW LEVEL SECURITY;

-- Reps see their own; admins see all
CREATE POLICY "Reps view own sales activity"
  ON public.sales_activity FOR SELECT
  TO authenticated
  USING (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert own sales activity"
  ON public.sales_activity FOR INSERT
  TO authenticated
  WITH CHECK (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_sales_activity_created_at ON public.sales_activity(created_at DESC);
CREATE INDEX idx_sales_activity_rep ON public.sales_activity(rep_id);
