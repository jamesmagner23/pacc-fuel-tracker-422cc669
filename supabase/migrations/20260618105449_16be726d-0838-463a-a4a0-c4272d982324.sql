
ALTER TABLE public.competitor_analyses
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS user_note TEXT;

CREATE INDEX IF NOT EXISTS idx_competitor_analyses_label ON public.competitor_analyses(label);
