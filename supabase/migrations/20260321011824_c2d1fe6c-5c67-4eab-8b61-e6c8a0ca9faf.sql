CREATE POLICY "Allow public read on client_accounts"
ON public.client_accounts
FOR SELECT
TO public
USING (true);