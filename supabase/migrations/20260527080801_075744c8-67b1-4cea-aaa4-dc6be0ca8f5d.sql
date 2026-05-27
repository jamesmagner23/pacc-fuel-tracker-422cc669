
ALTER TABLE public.dispatch_stops
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_signature text,
  ADD COLUMN IF NOT EXISTS driver_signature text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_notes text,
  ADD COLUMN IF NOT EXISTS products jsonb;
