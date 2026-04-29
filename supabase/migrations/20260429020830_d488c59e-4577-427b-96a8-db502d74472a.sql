CREATE TABLE public.outreach_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_by UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('default_mail','gmail')),
  pipedrive_person_id BIGINT,
  recipient_name TEXT,
  recipient_email TEXT,
  organisation TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  bcc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read outreach log"
ON public.outreach_send_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert outreach log"
ON public.outreach_send_log
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND sent_by = auth.uid());

CREATE INDEX idx_outreach_send_log_created_at ON public.outreach_send_log (created_at DESC);
CREATE INDEX idx_outreach_send_log_person ON public.outreach_send_log (pipedrive_person_id);