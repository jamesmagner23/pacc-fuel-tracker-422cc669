
-- SOP Sections table (procedures)
CREATE TABLE public.sop_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  subsections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sop_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sop_sections"
  ON public.sop_sections FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers read sop_sections"
  ON public.sop_sections FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'driver'));

-- SOP Client Sites table
CREATE TABLE public.sop_client_sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client text NOT NULL,
  site text NOT NULL,
  address text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  preferred_days text NOT NULL DEFAULT '',
  codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sop_client_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sop_client_sites"
  ON public.sop_client_sites FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers read sop_client_sites"
  ON public.sop_client_sites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'driver'));
