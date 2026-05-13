ALTER TABLE public.dispatch_stops
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE POLICY "Drivers create dispatch_stops"
ON public.dispatch_stops
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'driver'::app_role));