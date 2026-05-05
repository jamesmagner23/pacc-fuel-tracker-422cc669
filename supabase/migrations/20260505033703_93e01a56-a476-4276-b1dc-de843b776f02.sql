-- Customer branding: per-account logo + brand accent color
ALTER TABLE public.client_accounts
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_accent text,
  ADD COLUMN IF NOT EXISTS branding_enabled boolean NOT NULL DEFAULT false;

-- Public bucket for client logos (publicly readable so the portal can render
-- them without signing every URL; uploads are admin-gated below).
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view logos (public bucket already implies this, but explicit policy
-- keeps things consistent).
DROP POLICY IF EXISTS "Public read client logos" ON storage.objects;
CREATE POLICY "Public read client logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-logos');

-- Only admins may upload / update / delete logos.
DROP POLICY IF EXISTS "Admins manage client logos insert" ON storage.objects;
CREATE POLICY "Admins manage client logos insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage client logos update" ON storage.objects;
CREATE POLICY "Admins manage client logos update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage client logos delete" ON storage.objects;
CREATE POLICY "Admins manage client logos delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-logos' AND public.has_role(auth.uid(), 'admin'));
