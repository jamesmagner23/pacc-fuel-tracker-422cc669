
CREATE POLICY "Drivers can read client accounts"
ON public.client_accounts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'driver'::app_role));
