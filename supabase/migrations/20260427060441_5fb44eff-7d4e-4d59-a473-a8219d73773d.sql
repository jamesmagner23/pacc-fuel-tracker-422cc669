ALTER TABLE public.plant_items
ADD COLUMN IF NOT EXISTS ftc_rate_id uuid REFERENCES public.ftc_rates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plant_items_ftc_rate_id ON public.plant_items(ftc_rate_id);