-- Demo analytics events: track engagement from email-driven demo visits
CREATE TABLE public.demo_analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT,
  section TEXT,
  brand TEXT,
  accent_color TEXT,
  session_id TEXT,
  referrer TEXT,
  user_agent TEXT,
  path TEXT,
  search_params TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_analytics_events_created_at ON public.demo_analytics_events (created_at DESC);
CREATE INDEX idx_demo_analytics_events_session ON public.demo_analytics_events (session_id);
CREATE INDEX idx_demo_analytics_events_type ON public.demo_analytics_events (event_type);

ALTER TABLE public.demo_analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous demo visitors) may record events
CREATE POLICY "Anyone can insert demo analytics events"
ON public.demo_analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view demo analytics events"
ON public.demo_analytics_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can modify/delete
CREATE POLICY "Admins can update demo analytics events"
ON public.demo_analytics_events
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete demo analytics events"
ON public.demo_analytics_events
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));