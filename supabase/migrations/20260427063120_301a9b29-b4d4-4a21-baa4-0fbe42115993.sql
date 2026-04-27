-- 1. Extend plant_items with detailed equipment fields
ALTER TABLE public.plant_items
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS tank_size_litres numeric,
  ADD COLUMN IF NOT EXISTS colour text;

-- 2. Private bucket for plant photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS: clients can manage photos within their own client_account folder
-- Folder convention: client_account_id (as text) is the FIRST path segment.

-- SELECT
DROP POLICY IF EXISTS "Clients view own plant photos" ON storage.objects;
CREATE POLICY "Clients view own plant photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = public.get_user_client_account_id(auth.uid())::text
);

DROP POLICY IF EXISTS "Admins view all plant photos" ON storage.objects;
CREATE POLICY "Admins view all plant photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND public.has_role(auth.uid(), 'admin')
);

-- INSERT
DROP POLICY IF EXISTS "Clients upload own plant photos" ON storage.objects;
CREATE POLICY "Clients upload own plant photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = public.get_user_client_account_id(auth.uid())::text
);

DROP POLICY IF EXISTS "Admins upload plant photos" ON storage.objects;
CREATE POLICY "Admins upload plant photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plant-photos'
  AND public.has_role(auth.uid(), 'admin')
);

-- UPDATE
DROP POLICY IF EXISTS "Clients update own plant photos" ON storage.objects;
CREATE POLICY "Clients update own plant photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = public.get_user_client_account_id(auth.uid())::text
);

DROP POLICY IF EXISTS "Admins update plant photos" ON storage.objects;
CREATE POLICY "Admins update plant photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND public.has_role(auth.uid(), 'admin')
);

-- DELETE
DROP POLICY IF EXISTS "Clients delete own plant photos" ON storage.objects;
CREATE POLICY "Clients delete own plant photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND (storage.foldername(name))[1] = public.get_user_client_account_id(auth.uid())::text
);

DROP POLICY IF EXISTS "Admins delete plant photos" ON storage.objects;
CREATE POLICY "Admins delete plant photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'plant-photos'
  AND public.has_role(auth.uid(), 'admin')
);