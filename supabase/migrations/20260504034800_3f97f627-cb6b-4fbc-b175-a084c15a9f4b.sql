-- Allow multiple suppliers per day on buy_prices
ALTER TABLE public.buy_prices DROP CONSTRAINT IF EXISTS buy_prices_price_date_key;
ALTER TABLE public.buy_prices ALTER COLUMN supplier SET NOT NULL;
ALTER TABLE public.buy_prices ALTER COLUMN supplier SET DEFAULT 'Pacific';
CREATE UNIQUE INDEX IF NOT EXISTS buy_prices_date_supplier_key ON public.buy_prices (price_date, supplier);
CREATE INDEX IF NOT EXISTS buy_prices_supplier_idx ON public.buy_prices (supplier);