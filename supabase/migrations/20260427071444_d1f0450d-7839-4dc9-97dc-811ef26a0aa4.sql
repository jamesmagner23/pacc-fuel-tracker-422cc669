-- Shared tag library scoped per client_account
CREATE TABLE public.plant_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_account_id bigint NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  colour text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_account_id, name)
);

CREATE INDEX idx_plant_tags_client ON public.plant_tags(client_account_id);

ALTER TABLE public.plant_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plant_tags"
  ON public.plant_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients manage own plant_tags"
  ON public.plant_tags FOR ALL TO authenticated
  USING (client_account_id = public.get_user_client_account_id(auth.uid()))
  WITH CHECK (client_account_id = public.get_user_client_account_id(auth.uid()));

CREATE TRIGGER trg_plant_tags_touch
  BEFORE UPDATE ON public.plant_tags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Join table
CREATE TABLE public.plant_item_tags (
  plant_item_id uuid NOT NULL REFERENCES public.plant_items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.plant_tags(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (plant_item_id, tag_id)
);

CREATE INDEX idx_plant_item_tags_tag ON public.plant_item_tags(tag_id);

ALTER TABLE public.plant_item_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plant_item_tags"
  ON public.plant_item_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients manage own plant_item_tags"
  ON public.plant_item_tags FOR ALL TO authenticated
  USING (
    plant_item_id IN (
      SELECT id FROM public.plant_items
      WHERE client_account_id = public.get_user_client_account_id(auth.uid())
    )
  )
  WITH CHECK (
    plant_item_id IN (
      SELECT id FROM public.plant_items
      WHERE client_account_id = public.get_user_client_account_id(auth.uid())
    )
  );