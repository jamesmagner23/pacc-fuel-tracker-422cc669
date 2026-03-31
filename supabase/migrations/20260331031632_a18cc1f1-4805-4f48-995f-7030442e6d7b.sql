
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;
