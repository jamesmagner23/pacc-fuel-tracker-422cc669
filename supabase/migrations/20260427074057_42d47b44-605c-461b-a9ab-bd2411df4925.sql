-- transaction_overrides: lets admins/drivers manually assign a SpeedSol
-- delivery to a specific plant item and/or project, overriding the
-- placa-based inheritance chain.
CREATE TABLE IF NOT EXISTS public.transaction_overrides (
  transaction_id integer PRIMARY KEY,
  plant_item_id uuid NULL REFERENCES public.plant_items(id) ON DELETE SET NULL,
  project_id    uuid NULL REFERENCES public.projects(id)    ON DELETE SET NULL,
  notes         text NULL,
  set_by        uuid NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_overrides_plant_item
  ON public.transaction_overrides(plant_item_id);
CREATE INDEX IF NOT EXISTS idx_transaction_overrides_project
  ON public.transaction_overrides(project_id);

DROP TRIGGER IF EXISTS trg_transaction_overrides_touch ON public.transaction_overrides;
CREATE TRIGGER trg_transaction_overrides_touch
  BEFORE UPDATE ON public.transaction_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.transaction_overrides ENABLE ROW LEVEL SECURITY;

-- Admins: full access
DROP POLICY IF EXISTS "Admins manage transaction_overrides" ON public.transaction_overrides;
CREATE POLICY "Admins manage transaction_overrides"
  ON public.transaction_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Drivers: full read + write (they tag deliveries during/after their day)
DROP POLICY IF EXISTS "Drivers manage transaction_overrides" ON public.transaction_overrides;
CREATE POLICY "Drivers manage transaction_overrides"
  ON public.transaction_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'driver'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'driver'::public.app_role));

-- Clients: read overrides on transactions their account owns
DROP POLICY IF EXISTS "Clients read own transaction_overrides" ON public.transaction_overrides;
CREATE POLICY "Clients read own transaction_overrides"
  ON public.transaction_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_overrides.transaction_id
        AND public.user_owns_speedsol_name(auth.uid(), t.nombre_cliente1)
    )
  );