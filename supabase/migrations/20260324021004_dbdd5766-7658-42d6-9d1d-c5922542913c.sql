
CREATE TABLE public.auth_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.auth_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity"
ON public.auth_activity_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert own activity"
ON public.auth_activity_log FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_auth_activity_user ON public.auth_activity_log(user_id);
CREATE INDEX idx_auth_activity_created ON public.auth_activity_log(created_at DESC);
