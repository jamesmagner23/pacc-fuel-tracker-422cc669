
CREATE TABLE public.quote_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_email text,
  litres numeric NOT NULL,
  buy_price_per_litre numeric NOT NULL,
  sell_price_per_litre numeric NOT NULL,
  margin_pct numeric NOT NULL,
  payment_terms_days integer,
  supplier text,
  driver_note text,
  breach_reasons text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_approval_requests TO authenticated;
GRANT ALL ON public.quote_approval_requests TO service_role;

ALTER TABLE public.quote_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers see own requests"
  ON public.quote_approval_requests FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers insert own requests"
  ON public.quote_approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid() AND (public.has_role(auth.uid(), 'driver') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins update requests"
  ON public.quote_approval_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete requests"
  ON public.quote_approval_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER quote_approval_requests_updated_at
  BEFORE UPDATE ON public.quote_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX quote_approval_requests_status_idx ON public.quote_approval_requests(status, created_at DESC);
CREATE INDEX quote_approval_requests_driver_idx ON public.quote_approval_requests(driver_id, created_at DESC);
