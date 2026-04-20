-- FTC rates table (editable ATO fuel tax credit rates)
CREATE TABLE public.ftc_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_type text NOT NULL UNIQUE,
  rate_per_litre numeric NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  display_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ftc_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ftc rates"
  ON public.ftc_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage ftc rates"
  ON public.ftc_rates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed rates (Feb 2025)
INSERT INTO public.ftc_rates (equipment_type, rate_per_litre, effective_from, display_order, notes) VALUES
  ('Machinery & Plant (off-road)', 0.496, '2025-02-03', 1, 'Off-road business use'),
  ('Diesel Generators', 0.496, '2025-02-03', 2, 'Stationary power generation'),
  ('Heavy Vehicles on public road (>4.5t)', 0.204, '2025-02-03', 3, 'Net of road user charge'),
  ('Light Vehicles', 0.000, '2025-02-03', 4, 'Not eligible for FTC');

-- Delivery requests table (customer-submitted scheduling requests)
CREATE TABLE public.delivery_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_account_id bigint NOT NULL,
  site_name text NOT NULL,
  estimated_litres numeric,
  preferred_date date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage delivery requests"
  ON public.delivery_requests FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients read own delivery requests"
  ON public.delivery_requests FOR SELECT
  TO authenticated
  USING (client_account_id = get_user_client_account_id(auth.uid()));

CREATE POLICY "Clients insert own delivery requests"
  ON public.delivery_requests FOR INSERT
  TO authenticated
  WITH CHECK (client_account_id = get_user_client_account_id(auth.uid()));

CREATE INDEX idx_delivery_requests_client ON public.delivery_requests(client_account_id, preferred_date DESC);