CREATE POLICY "Drivers can view all transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'driver'::app_role));