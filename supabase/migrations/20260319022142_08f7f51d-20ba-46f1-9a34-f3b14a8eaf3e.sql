
DROP POLICY IF EXISTS "Authenticated users full access" ON public.buy_prices;

CREATE POLICY "Allow public read access on buy_prices"
ON public.buy_prices FOR SELECT TO public
USING (true);

CREATE POLICY "Allow public insert on buy_prices"
ON public.buy_prices FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Allow public update on buy_prices"
ON public.buy_prices FOR UPDATE TO public
USING (true);

CREATE POLICY "Allow public delete on buy_prices"
ON public.buy_prices FOR DELETE TO public
USING (true);
