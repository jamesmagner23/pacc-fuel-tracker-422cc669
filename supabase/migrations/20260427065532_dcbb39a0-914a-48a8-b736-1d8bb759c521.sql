CREATE OR REPLACE FUNCTION public.guard_client_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.billing_address_line1 IS DISTINCT FROM OLD.billing_address_line1
     OR NEW.billing_address_line2 IS DISTINCT FROM OLD.billing_address_line2
     OR NEW.billing_suburb IS DISTINCT FROM OLD.billing_suburb
     OR NEW.billing_state IS DISTINCT FROM OLD.billing_state
     OR NEW.billing_postcode IS DISTINCT FROM OLD.billing_postcode
     OR NEW.billing_country IS DISTINCT FROM OLD.billing_country
  THEN
    RAISE EXCEPTION 'Only admins can change billing address';
  END IF;

  RETURN NEW;
END;
$$;