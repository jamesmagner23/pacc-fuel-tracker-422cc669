CREATE OR REPLACE FUNCTION public.get_last_sync_status()
RETURNS TABLE(synced_at timestamp with time zone, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT synced_at, status
  FROM public.sync_log
  WHERE status = 'success'
  ORDER BY synced_at DESC NULLS LAST
  LIMIT 1
$function$;
REVOKE EXECUTE ON FUNCTION public.get_last_sync_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_last_sync_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_last_sync_status() TO service_role;