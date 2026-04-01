
CREATE TABLE public.demo_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text NOT NULL,
  brand_param text,
  color_param text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (demo visitors aren't authenticated)
CREATE POLICY "Anyone can submit a demo lead"
  ON public.demo_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admins can view all leads
CREATE POLICY "Admins can view demo leads"
  ON public.demo_leads
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
