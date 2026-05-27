
-- 1) driver_locations: restrict reads
DROP POLICY IF EXISTS "Authenticated read driver locations" ON public.driver_locations;
CREATE POLICY "Staff read driver locations"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR driver_user_id = auth.uid()
  );

-- 2) supplier_purchases: restrict reads
DROP POLICY IF EXISTS "Authenticated read supplier_purchases" ON public.supplier_purchases;
CREATE POLICY "Staff read supplier_purchases"
  ON public.supplier_purchases FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  );

-- 3) crm_settings: restrict reads
DROP POLICY IF EXISTS "Authenticated read crm_settings" ON public.crm_settings;
CREATE POLICY "Staff read crm_settings"
  ON public.crm_settings FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR has_role(auth.uid(), 'driver'::app_role)
  );

-- 4) Harden get_user_client_account_id to only return client rows
CREATE OR REPLACE FUNCTION public.get_user_client_account_id(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT client_account_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND role = 'client'::app_role
    AND client_account_id IS NOT NULL
  LIMIT 1
$function$;

-- 5) Realtime channel authorization: restrict driver_locations_feed
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restrict driver location channel" ON realtime.messages;
CREATE POLICY "Restrict driver location channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() = 'driver_locations_feed' THEN
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operations'::app_role)
        OR public.has_role(auth.uid(), 'driver'::app_role)
      ELSE true
    END
  );
