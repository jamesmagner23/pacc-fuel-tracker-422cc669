
CREATE TABLE public.quote_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  site_address TEXT NOT NULL,
  delivery_date DATE,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'landing_page',
  status TEXT NOT NULL DEFAULT 'new',
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT quote_leads_company_len CHECK (char_length(company) BETWEEN 1 AND 200),
  CONSTRAINT quote_leads_contact_len CHECK (char_length(contact_name) BETWEEN 1 AND 200),
  CONSTRAINT quote_leads_phone_len CHECK (char_length(phone) BETWEEN 4 AND 40),
  CONSTRAINT quote_leads_site_len CHECK (char_length(site_address) BETWEEN 1 AND 400),
  CONSTRAINT quote_leads_notes_len CHECK (notes IS NULL OR char_length(notes) <= 1000)
);

ALTER TABLE public.quote_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a quote lead"
  ON public.quote_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins and ops can view leads"
  ON public.quote_leads
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operations')
  );

CREATE POLICY "Admins and ops can update leads"
  ON public.quote_leads
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operations')
  );

CREATE POLICY "Admins can delete leads"
  ON public.quote_leads
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_quote_leads_created_at ON public.quote_leads (created_at DESC);
CREATE INDEX idx_quote_leads_status ON public.quote_leads (status);

CREATE TRIGGER update_quote_leads_updated_at
  BEFORE UPDATE ON public.quote_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
