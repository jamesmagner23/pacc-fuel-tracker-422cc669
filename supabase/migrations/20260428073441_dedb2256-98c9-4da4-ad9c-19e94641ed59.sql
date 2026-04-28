-- 1) Partial unique index: only one open assignment per plant item
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_assignment_per_plant
  ON public.project_plant_assignments (plant_item_id)
  WHERE removed_at IS NULL;

-- 2) Audit log table
CREATE TABLE IF NOT EXISTS public.plant_assignment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_item_id uuid NOT NULL,
  from_project_id uuid,
  to_project_id uuid,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'drag_and_drop',
  notes text
);

CREATE INDEX IF NOT EXISTS idx_paa_plant_item ON public.plant_assignment_audit (plant_item_id, changed_at DESC);

ALTER TABLE public.plant_assignment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plant_assignment_audit"
  ON public.plant_assignment_audit
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients read own plant_assignment_audit"
  ON public.plant_assignment_audit
  FOR SELECT
  TO authenticated
  USING (
    plant_item_id IN (
      SELECT id FROM public.plant_items
      WHERE client_account_id = get_user_client_account_id(auth.uid())
    )
  );