ALTER TABLE public.quote_leads ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.quote_leads ADD COLUMN IF NOT EXISTS estimated_litres numeric;
COMMENT ON COLUMN public.quote_leads.email IS 'Contact email supplied through the public quote form.';
COMMENT ON COLUMN public.quote_leads.estimated_litres IS 'Optional estimated delivery volume supplied through the public quote form.';