
-- Pump readings table for driver-logged daily readings
CREATE TABLE public.pump_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_date date NOT NULL DEFAULT CURRENT_DATE,
  litres numeric NOT NULL,
  driver_id uuid NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pump_readings ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own readings
CREATE POLICY "Drivers insert own pump readings"
  ON public.pump_readings FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid() AND has_role(auth.uid(), 'driver'));

-- Drivers can view own readings
CREATE POLICY "Drivers view own pump readings"
  ON public.pump_readings FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins manage pump readings"
  ON public.pump_readings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Reconciliation alerts table
CREATE TABLE public.reconciliation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_date date NOT NULL,
  alert_type text NOT NULL,
  values jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',
  suggested_action text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.reconciliation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reconciliation alerts"
  ON public.reconciliation_alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Reconciliation settings table (single row)
CREATE TABLE public.recon_settings (
  id integer PRIMARY KEY DEFAULT 1,
  variance_threshold_pct numeric NOT NULL DEFAULT 2,
  variance_threshold_litres numeric NOT NULL DEFAULT 50,
  alert_sensitivity text NOT NULL DEFAULT 'medium',
  calibration_factor numeric NOT NULL DEFAULT 0,
  auto_weekly_report boolean NOT NULL DEFAULT false,
  report_email text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.recon_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage recon settings"
  ON public.recon_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default settings row
INSERT INTO public.recon_settings (id) VALUES (1);
