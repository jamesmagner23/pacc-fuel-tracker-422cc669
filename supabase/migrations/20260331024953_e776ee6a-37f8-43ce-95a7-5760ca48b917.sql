
-- Drop the unique constraint on client_account_id so multiple tiers per client are allowed
ALTER TABLE public.customer_pricing DROP CONSTRAINT IF EXISTS customer_pricing_client_account_id_key;

-- Add volume range columns for tier-based pricing
ALTER TABLE public.customer_pricing ADD COLUMN IF NOT EXISTS min_litres numeric NOT NULL DEFAULT 0;
ALTER TABLE public.customer_pricing ADD COLUMN IF NOT EXISTS max_litres numeric;
ALTER TABLE public.customer_pricing ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'margin';
