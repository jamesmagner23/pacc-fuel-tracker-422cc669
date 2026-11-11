CREATE TABLE public.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')
);
GRANT SELECT ON public.cron_tokens TO service_role;
REVOKE ALL ON public.cron_tokens FROM anon, authenticated;
ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.cron_tokens IS 'Private scheduler credentials. No user-facing policies or grants.';