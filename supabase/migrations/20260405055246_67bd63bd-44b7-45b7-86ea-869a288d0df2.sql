
CREATE POLICY "Service role insert market briefings"
  ON public.market_briefings FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update market briefings"
  ON public.market_briefings FOR UPDATE
  TO service_role
  USING (true);
