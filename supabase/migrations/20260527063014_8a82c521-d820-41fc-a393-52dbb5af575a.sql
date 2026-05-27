
-- Allow clients to read driver locations (needed for portal truck map)
DROP POLICY IF EXISTS "Clients read driver locations" ON public.driver_locations;
CREATE POLICY "Clients read driver locations"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'client'::app_role));

-- Extend realtime channel policy to include clients
DROP POLICY IF EXISTS "Restrict driver location channel" ON realtime.messages;
CREATE POLICY "Restrict driver location channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() = 'driver_locations_feed' THEN
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operations'::app_role)
        OR public.has_role(auth.uid(), 'driver'::app_role)
        OR public.has_role(auth.uid(), 'client'::app_role)
      ELSE true
    END
  );
