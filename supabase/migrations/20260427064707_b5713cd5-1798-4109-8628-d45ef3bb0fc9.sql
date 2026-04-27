CREATE OR REPLACE FUNCTION public.get_last_sync_status()
RETURNS TABLE(synced_at timestamptz, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT synced_at, status
  FROM public.sync_log
  ORDER BY synced_at DESC NULLS LAST
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_last_sync_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_last_sync_status() TO authenticated;