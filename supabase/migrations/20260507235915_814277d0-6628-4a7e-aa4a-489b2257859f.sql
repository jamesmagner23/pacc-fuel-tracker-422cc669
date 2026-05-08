
CREATE TABLE public.driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id uuid NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  speed numeric,
  heading numeric,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_locations_driver_recorded
  ON public.driver_locations (driver_user_id, recorded_at DESC);

CREATE INDEX idx_driver_locations_recorded
  ON public.driver_locations (recorded_at DESC);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own pings
CREATE POLICY "Drivers insert own location"
  ON public.driver_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_user_id = auth.uid()
    AND public.has_role(auth.uid(), 'driver')
  );

-- Any authenticated user (admin, driver, client) can read locations
CREATE POLICY "Authenticated read driver locations"
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage (cleanup/delete)
CREATE POLICY "Admins manage driver locations"
  ON public.driver_locations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
