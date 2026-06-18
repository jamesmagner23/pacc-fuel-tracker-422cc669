
CREATE TABLE public.competitor_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'kept' CHECK (status IN ('kept','archived')),
  filename TEXT,
  supplier_name TEXT,
  invoice_date DATE,
  customer_name TEXT,
  customer_address TEXT,
  fuel_type TEXT,
  litres NUMERIC,
  price_per_litre_ex_gst NUMERIC,
  price_per_litre_inc_gst NUMERIC,
  delivery_fee_ex_gst NUMERIC,
  subtotal_ex_gst NUMERIC,
  gst_amount NUMERIC,
  total_inc_gst NUMERIC,
  notes TEXT,
  our_buy_supplier TEXT,
  our_buy_price NUMERIC,
  our_buy_price_date DATE,
  margin_per_litre NUMERIC,
  margin_pct NUMERIC,
  total_profit NUMERIC,
  extracted JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_analyses TO authenticated;
GRANT ALL ON public.competitor_analyses TO service_role;

ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage competitor analyses"
  ON public.competitor_analyses
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_competitor_analyses_updated
  BEFORE UPDATE ON public.competitor_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_competitor_analyses_created_at ON public.competitor_analyses(created_at DESC);
CREATE INDEX idx_competitor_analyses_status ON public.competitor_analyses(status);
