
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.supplier_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date date NOT NULL,
  supplier text NOT NULL,
  litres numeric NOT NULL,
  price_per_litre_ex_gst numeric NOT NULL,
  total_ex_gst numeric GENERATED ALWAYS AS (litres * price_per_litre_ex_gst) STORED,
  invoice_ref text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage supplier_purchases"
  ON public.supplier_purchases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read supplier_purchases"
  ON public.supplier_purchases FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_supplier_purchases_updated_at
  BEFORE UPDATE ON public.supplier_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_supplier_purchases_date ON public.supplier_purchases (purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_supplier ON public.supplier_purchases (supplier);

CREATE TABLE IF NOT EXISTS public.supplier_price_scrape_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_at timestamptz NOT NULL DEFAULT now(),
  supplier text,
  status text NOT NULL,
  price_per_litre numeric,
  price_date date,
  gmail_message_id text,
  raw_excerpt text,
  error text
);

ALTER TABLE public.supplier_price_scrape_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read scrape log"
  ON public.supplier_price_scrape_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role writes scrape log"
  ON public.supplier_price_scrape_log FOR INSERT TO service_role
  WITH CHECK (true);
