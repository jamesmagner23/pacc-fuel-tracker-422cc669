
-- 1. Driver locations: remove blanket client read
DROP POLICY IF EXISTS "Clients read driver locations" ON public.driver_locations;

-- 2. Realtime channel: drop client role from driver_locations_feed
DROP POLICY IF EXISTS "Restrict driver location channel" ON realtime.messages;
CREATE POLICY "Restrict driver location channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() = 'driver_locations_feed'::text THEN (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'operations'::app_role)
        OR has_role(auth.uid(), 'driver'::app_role)
      )
      ELSE true
    END
  );

-- 3. Scheduled deliveries: add operations read access
CREATE POLICY "Operations read scheduled deliveries"
  ON public.scheduled_deliveries
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'operations'::app_role));
