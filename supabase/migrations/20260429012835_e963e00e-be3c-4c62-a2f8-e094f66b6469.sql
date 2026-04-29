CREATE TABLE public.email_cta_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cta_id text NOT NULL,
  campaign text NOT NULL DEFAULT 'unknown',
  destination text,
  user_agent text,
  referer text,
  ip_hash text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_cta_clicks_clicked_at ON public.email_cta_clicks (clicked_at DESC);
CREATE INDEX idx_email_cta_clicks_cta_campaign ON public.email_cta_clicks (cta_id, campaign);

ALTER TABLE public.email_cta_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a click"
  ON public.email_cta_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins read clicks"
  ON public.email_cta_clicks
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
