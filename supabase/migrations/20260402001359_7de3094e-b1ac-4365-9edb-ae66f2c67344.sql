-- Restrict bowser-photos viewing to drivers and admins only
DROP POLICY IF EXISTS "Authenticated users can view bowser photos" ON storage.objects;

CREATE POLICY "Drivers and admins view bowser photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bowser-photos'
    AND (
      public.has_role(auth.uid(), 'driver'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );