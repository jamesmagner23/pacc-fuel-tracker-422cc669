CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.pricing_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  weekly_volume TEXT,
  product_mix JSONB NOT NULL DEFAULT '{"diesel":true,"ulp":false,"adblue":false}'::jsonb,
  diesel_price NUMERIC,
  diesel_price_inc NUMERIC,
  ulp_price NUMERIC,
  ulp_price_inc NUMERIC,
  adblue_price NUMERIC,
  adblue_price_inc NUMERIC,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pricing presets"
  ON public.pricing_presets
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pricing_presets_updated_at
  BEFORE UPDATE ON public.pricing_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pricing_presets_created_at ON public.pricing_presets (created_at DESC);