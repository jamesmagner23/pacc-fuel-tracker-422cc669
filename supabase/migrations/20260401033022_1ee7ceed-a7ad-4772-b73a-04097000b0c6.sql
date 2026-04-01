CREATE TABLE public.terminal_gate_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date date NOT NULL,
  location text NOT NULL DEFAULT 'Melbourne',
  product text NOT NULL DEFAULT 'Diesel',
  price_cpl numeric NOT NULL,
  price_per_litre numeric GENERATED ALWAYS AS (price_cpl / 100.0) STORED,
  source text NOT NULL DEFAULT 'AIP',
  created_at timestamptz DEFAULT now(),
  UNIQUE(price_date, location, product)
);

ALTER TABLE public.terminal_gate_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage TGP" ON public.terminal_gate_prices FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role insert TGP" ON public.terminal_gate_prices FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated read TGP" ON public.terminal_gate_prices FOR SELECT TO authenticated
  USING (true);