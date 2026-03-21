
-- Pricing tiers table
CREATE TABLE public.pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL,
  min_litres numeric NOT NULL DEFAULT 0,
  max_litres numeric,
  margin_percent numeric NOT NULL DEFAULT 8,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on pricing_tiers" ON public.pricing_tiers FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert on pricing_tiers" ON public.pricing_tiers FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update on pricing_tiers" ON public.pricing_tiers FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete on pricing_tiers" ON public.pricing_tiers FOR DELETE TO public USING (true);

-- Insert default tiers
INSERT INTO public.pricing_tiers (tier_name, min_litres, max_litres, margin_percent) VALUES
  ('Small', 0, 5000, 12),
  ('Medium', 5000, 10000, 10),
  ('Large', 10000, NULL, 8);

-- Quotes table
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  volume_litres numeric NOT NULL,
  buy_price_per_litre numeric NOT NULL,
  margin_percent numeric NOT NULL,
  sell_price_per_litre numeric NOT NULL,
  total_ex_gst numeric NOT NULL,
  total_inc_gst numeric NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  valid_until date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on quotes" ON public.quotes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert on quotes" ON public.quotes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update on quotes" ON public.quotes FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete on quotes" ON public.quotes FOR DELETE TO public USING (true);
