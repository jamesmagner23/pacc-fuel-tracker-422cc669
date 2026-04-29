ALTER TABLE public.outreach_send_log
  ADD COLUMN IF NOT EXISTS gmail_message_id text,
  ADD COLUMN IF NOT EXISTS gmail_thread_id text,
  ADD COLUMN IF NOT EXISTS send_status text NOT NULL DEFAULT 'sent';

CREATE INDEX IF NOT EXISTS outreach_send_log_created_at_idx
  ON public.outreach_send_log (created_at DESC);

CREATE INDEX IF NOT EXISTS outreach_send_log_sent_by_idx
  ON public.outreach_send_log (sent_by);