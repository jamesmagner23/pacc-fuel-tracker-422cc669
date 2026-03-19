
CREATE TABLE public.buy_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date date NOT NULL UNIQUE,
  price_per_litre numeric NOT NULL,
  supplier text DEFAULT 'Pacific',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.buy_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
ON public.buy_prices
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
