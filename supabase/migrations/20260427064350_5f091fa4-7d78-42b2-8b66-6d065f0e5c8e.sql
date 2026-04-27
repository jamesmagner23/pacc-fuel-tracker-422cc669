-- Client profile: extended business details + multi-contact
-- Editability split: clients can update contact-only fields; only admins can update ABN/billing.

CREATE TABLE public.client_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_account_id BIGINT NOT NULL UNIQUE REFERENCES public.client_accounts(id) ON DELETE CASCADE,

  -- Admin-managed (financial / legal)
  legal_business_name TEXT,
  abn TEXT,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_suburb TEXT,
  billing_state TEXT,
  billing_postcode TEXT,
  billing_country TEXT DEFAULT 'Australia',

  -- Client-editable
  website TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  ops_contact_name TEXT,
  ops_contact_email TEXT,
  ops_contact_phone TEXT,
  accounts_contact_name TEXT,
  accounts_contact_email TEXT,
  accounts_contact_phone TEXT,
  site_contact_name TEXT,
  site_contact_email TEXT,
  site_contact_phone TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Read: admins anything; clients only their own
CREATE POLICY "Admins read all client profiles"
ON public.client_profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients read own profile"
ON public.client_profiles FOR SELECT TO authenticated
USING (client_account_id = public.get_user_client_account_id(auth.uid()));

-- Insert: admins always; clients can create own row (one-time)
CREATE POLICY "Admins insert client profiles"
ON public.client_profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients insert own profile"
ON public.client_profiles FOR INSERT TO authenticated
WITH CHECK (client_account_id = public.get_user_client_account_id(auth.uid()));

-- Update: admins anything
CREATE POLICY "Admins update client profiles"
ON public.client_profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update: clients can update own row, but admin-only columns are guarded by trigger
CREATE POLICY "Clients update own profile (contact fields)"
ON public.client_profiles FOR UPDATE TO authenticated
USING (client_account_id = public.get_user_client_account_id(auth.uid()))
WITH CHECK (client_account_id = public.get_user_client_account_id(auth.uid()));

-- Delete: admins only
CREATE POLICY "Admins delete client profiles"
ON public.client_profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: prevent non-admins from changing admin-managed columns
CREATE OR REPLACE FUNCTION public.guard_client_profile_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.legal_business_name IS DISTINCT FROM OLD.legal_business_name
     OR NEW.abn IS DISTINCT FROM OLD.abn
     OR NEW.billing_address_line1 IS DISTINCT FROM OLD.billing_address_line1
     OR NEW.billing_address_line2 IS DISTINCT FROM OLD.billing_address_line2
     OR NEW.billing_suburb IS DISTINCT FROM OLD.billing_suburb
     OR NEW.billing_state IS DISTINCT FROM OLD.billing_state
     OR NEW.billing_postcode IS DISTINCT FROM OLD.billing_postcode
     OR NEW.billing_country IS DISTINCT FROM OLD.billing_country
  THEN
    RAISE EXCEPTION 'Only admins can change ABN, business name or billing address';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_profile_guard
BEFORE UPDATE ON public.client_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_client_profile_admin_fields();

CREATE TRIGGER trg_client_profile_touch
BEFORE UPDATE ON public.client_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();