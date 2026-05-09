
CREATE TABLE IF NOT EXISTS public.retail_bowser_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date date NOT NULL,
  source text NOT NULL,
  location text NOT NULL DEFAULT 'Melbourne',
  product text NOT NULL DEFAULT 'Diesel',
  price_inc_gst numeric NOT NULL,
  sample_size integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (price_date, source, location, product)
);

ALTER TABLE public.retail_bowser_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage retail bowser prices"
  ON public.retail_bowser_prices FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read retail bowser prices"
  ON public.retail_bowser_prices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role insert retail bowser prices"
  ON public.retail_bowser_prices FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update retail bowser prices"
  ON public.retail_bowser_prices FOR UPDATE
  TO service_role
  USING (true);

CREATE TRIGGER trg_retail_bowser_prices_updated
  BEFORE UPDATE ON public.retail_bowser_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_retail_bowser_prices_date_source
  ON public.retail_bowser_prices (price_date DESC, source);
