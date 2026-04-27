-- Plant & Equipment items per customer
CREATE TABLE public.plant_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id bigint NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  placa text,
  name text NOT NULL,
  equipment_type text,
  serial_number text,
  description text,
  photo_url text,
  service_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_account_id, placa)
);

CREATE INDEX idx_plant_items_client ON public.plant_items(client_account_id);
CREATE INDEX idx_plant_items_placa ON public.plant_items(placa);

ALTER TABLE public.plant_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plant_items"
  ON public.plant_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients read own plant_items"
  ON public.plant_items FOR SELECT TO authenticated
  USING (client_account_id = get_user_client_account_id(auth.uid()));

-- Projects per customer
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id bigint NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  site_address text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_client ON public.projects(client_account_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage projects"
  ON public.projects FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients read own projects"
  ON public.projects FOR SELECT TO authenticated
  USING (client_account_id = get_user_client_account_id(auth.uid()));

-- Project <-> plant item assignments
CREATE TABLE public.project_plant_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  plant_item_id uuid NOT NULL REFERENCES public.plant_items(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE (project_id, plant_item_id)
);

CREATE INDEX idx_ppa_project ON public.project_plant_assignments(project_id);
CREATE INDEX idx_ppa_plant ON public.project_plant_assignments(plant_item_id);

ALTER TABLE public.project_plant_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project_plant_assignments"
  ON public.project_plant_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients read own project_plant_assignments"
  ON public.project_plant_assignments FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE client_account_id = get_user_client_account_id(auth.uid())
    )
  );

-- Updated_at triggers (reuses existing or creates if missing)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_plant_items_updated BEFORE UPDATE ON public.plant_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();