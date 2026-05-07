
CREATE TABLE public.dispatch_recurring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id bigint NOT NULL,
  project_id uuid,
  truck_id uuid,
  site_name text NOT NULL,
  address text,
  estimated_litres numeric,
  notes text,
  frequency text NOT NULL DEFAULT 'weekly', -- 'daily' | 'weekly' | 'weekdays'
  weekdays integer[] NOT NULL DEFAULT '{}', -- 0=Sun..6=Sat for 'weekly'
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dispatch_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date date NOT NULL,
  client_account_id bigint NOT NULL,
  project_id uuid,
  truck_id uuid,
  driver_user_id uuid,
  site_name text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  estimated_litres numeric,
  delivered_litres numeric,
  sequence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | in_progress | completed | cancelled
  notes text,
  recurring_id uuid REFERENCES public.dispatch_recurring(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_stops_date ON public.dispatch_stops(scheduled_date);
CREATE INDEX idx_dispatch_stops_truck ON public.dispatch_stops(truck_id, scheduled_date);
CREATE INDEX idx_dispatch_stops_client ON public.dispatch_stops(client_account_id);

ALTER TABLE public.dispatch_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_recurring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage dispatch_stops" ON public.dispatch_stops
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers read dispatch_stops" ON public.dispatch_stops
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers update dispatch_stops" ON public.dispatch_stops
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role))
  WITH CHECK (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Clients read own dispatch_stops" ON public.dispatch_stops
  FOR SELECT TO authenticated
  USING (client_account_id = get_user_client_account_id(auth.uid()));

CREATE POLICY "Admins manage dispatch_recurring" ON public.dispatch_recurring
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients read own dispatch_recurring" ON public.dispatch_recurring
  FOR SELECT TO authenticated
  USING (client_account_id = get_user_client_account_id(auth.uid()));

CREATE POLICY "Drivers read dispatch_recurring" ON public.dispatch_recurring
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE TRIGGER trg_dispatch_stops_updated
  BEFORE UPDATE ON public.dispatch_stops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_dispatch_recurring_updated
  BEFORE UPDATE ON public.dispatch_recurring
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
