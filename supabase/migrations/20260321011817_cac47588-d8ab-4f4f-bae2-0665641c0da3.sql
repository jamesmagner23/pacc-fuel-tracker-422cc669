CREATE POLICY "Allow public insert on client_accounts"
ON public.client_accounts
FOR INSERT
TO public
WITH CHECK (true);