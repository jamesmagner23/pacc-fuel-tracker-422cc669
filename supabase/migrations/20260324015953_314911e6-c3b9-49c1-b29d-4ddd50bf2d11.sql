
-- Storage bucket for bowser photos
INSERT INTO storage.buckets (id, name, public) VALUES ('bowser-photos', 'bowser-photos', true);

-- Table to log fuel intake readings from drivers
CREATE TABLE public.fuel_intake_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  litres_entered numeric NOT NULL,
  photo_path text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fuel_intake_logs ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own logs
CREATE POLICY "Drivers can insert own intake logs"
ON public.fuel_intake_logs FOR INSERT TO authenticated
WITH CHECK (driver_user_id = auth.uid() AND has_role(auth.uid(), 'driver'::app_role));

-- Drivers can view their own logs
CREATE POLICY "Drivers can view own intake logs"
ON public.fuel_intake_logs FOR SELECT TO authenticated
USING (driver_user_id = auth.uid());

-- Admins can view all intake logs
CREATE POLICY "Admins can view all intake logs"
ON public.fuel_intake_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for bowser-photos bucket
CREATE POLICY "Drivers can upload bowser photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bowser-photos' AND has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Authenticated users can view bowser photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bowser-photos');
