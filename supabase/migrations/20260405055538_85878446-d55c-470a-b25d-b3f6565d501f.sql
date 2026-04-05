
CREATE TABLE public.market_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  value numeric NOT NULL,
  previous_value numeric,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'api',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_name, metric_date)
);

ALTER TABLE public.market_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage market metrics"
  ON public.market_metrics FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read market metrics"
  ON public.market_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role insert market metrics"
  ON public.market_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update market metrics"
  ON public.market_metrics FOR UPDATE
  TO service_role
  USING (true);
