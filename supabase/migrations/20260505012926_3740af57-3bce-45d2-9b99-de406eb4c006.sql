
-- Trucks table
CREATE TABLE public.trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rego text,
  speedsol_estacion text,
  make text,
  model text,
  vin text,
  serial_number text,
  tank_capacity_litres numeric,
  build_date date,
  current_km numeric,
  last_service_km numeric,
  last_service_date date,
  next_service_km numeric,
  next_service_date date,
  is_active boolean NOT NULL DEFAULT true,
  photo_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trucks" ON public.trucks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers read trucks" ON public.trucks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE TRIGGER trucks_touch BEFORE UPDATE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Truck documents
CREATE TABLE public.truck_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  label text,
  file_path text,
  issue_date date,
  expiry_date date,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.truck_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage truck_documents" ON public.truck_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers read truck_documents" ON public.truck_documents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE TRIGGER truck_documents_touch BEFORE UPDATE ON public.truck_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_truck_documents_truck ON public.truck_documents(truck_id);

-- Truck service records
CREATE TABLE public.truck_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  service_km numeric,
  service_type text,
  vendor text,
  cost numeric,
  file_path text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.truck_service_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage truck_service_records" ON public.truck_service_records
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers read truck_service_records" ON public.truck_service_records
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE TRIGGER truck_service_records_touch BEFORE UPDATE ON public.truck_service_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_truck_service_truck ON public.truck_service_records(truck_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('truck-docs', 'truck-docs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins manage truck-docs"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'truck-docs' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'truck-docs' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers read truck-docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'truck-docs' AND has_role(auth.uid(), 'driver'::app_role));

-- Seed fleet
INSERT INTO public.trucks (name, rego, speedsol_estacion, tank_capacity_litres) VALUES
  ('PACC Truck 1', NULL, 'PACC Truck 1', 8000),
  ('PACC Truck 2', 'XX-29BC', 'PACC Truck 2', 9500);

UPDATE public.trucks SET
  make = 'Isuzu',
  model = 'Capital Fleet SFL tanker',
  serial_number = '9512',
  build_date = '2026-02-01'
WHERE name = 'PACC Truck 2';
