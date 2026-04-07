
-- 1. Prevent non-admin users from writing to user_roles
CREATE POLICY "Non-admins cannot write user roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add explicit UPDATE/DELETE policies on bowser-photos storage
CREATE POLICY "Admins can update bowser photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'bowser-photos' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete bowser photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'bowser-photos' AND public.has_role(auth.uid(), 'admin'::app_role));
