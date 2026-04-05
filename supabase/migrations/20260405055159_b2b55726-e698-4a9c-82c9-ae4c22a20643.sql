
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create table for stored briefings
CREATE TABLE public.market_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date date NOT NULL DEFAULT CURRENT_DATE,
  content text NOT NULL,
  market_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'generated',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(briefing_date)
);

ALTER TABLE public.market_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage market briefings"
  ON public.market_briefings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read market briefings"
  ON public.market_briefings FOR SELECT
  TO authenticated
  USING (true);
