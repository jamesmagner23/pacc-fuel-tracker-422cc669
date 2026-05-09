
-- ============ CRM CUSTOMERS ============
CREATE TABLE public.crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'prospect' CHECK (kind IN ('prospect','client')),
  client_account_id BIGINT REFERENCES public.client_accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  source TEXT,
  owner_user_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  acquisition_stage TEXT NOT NULL DEFAULT 'new' CHECK (acquisition_stage IN ('new','contacted','quoted','won','lost')),
  retention_stage TEXT NOT NULL DEFAULT 'active' CHECK (retention_stage IN ('active','at_risk','churned')),
  lost_reason TEXT,
  next_follow_up_at DATE,
  estimated_value NUMERIC,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_customers_owner ON public.crm_customers(owner_user_id);
CREATE INDEX idx_crm_customers_kind_status ON public.crm_customers(kind, status);
CREATE INDEX idx_crm_customers_acq_stage ON public.crm_customers(acquisition_stage);
CREATE INDEX idx_crm_customers_ret_stage ON public.crm_customers(retention_stage);

ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage crm_customers" ON public.crm_customers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers read crm_customers" ON public.crm_customers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers insert crm_customers" ON public.crm_customers
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'driver'::app_role) AND created_by = auth.uid());

CREATE POLICY "Drivers update owned crm_customers" ON public.crm_customers
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role) AND owner_user_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'driver'::app_role) AND owner_user_id = auth.uid());

CREATE TRIGGER trg_crm_customers_updated_at
  BEFORE UPDATE ON public.crm_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CRM CONTACTS ============
CREATE TABLE public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  do_not_contact BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_contacts_customer ON public.crm_contacts(customer_id);
CREATE INDEX idx_crm_contacts_email_lower ON public.crm_contacts(LOWER(email));

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage crm_contacts" ON public.crm_contacts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers read crm_contacts" ON public.crm_contacts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers insert crm_contacts" ON public.crm_contacts
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers update crm_contacts" ON public.crm_contacts
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role))
  WITH CHECK (has_role(auth.uid(), 'driver'::app_role));

CREATE TRIGGER trg_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CRM ACTIVITIES ============
CREATE TABLE public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  user_id UUID,
  channel TEXT NOT NULL CHECK (channel IN ('email','call','sms','meeting','note')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound','internal')),
  subject TEXT,
  body_excerpt TEXT,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  outcome TEXT CHECK (outcome IN ('sent','replied','bounced','no_response','positive','negative','neutral')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_activities_customer_occurred ON public.crm_activities(customer_id, occurred_at DESC);
CREATE INDEX idx_crm_activities_contact ON public.crm_activities(contact_id);
CREATE INDEX idx_crm_activities_user_occurred ON public.crm_activities(user_id, occurred_at DESC);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage crm_activities" ON public.crm_activities
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers read crm_activities" ON public.crm_activities
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Drivers insert crm_activities" ON public.crm_activities
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'driver'::app_role) AND user_id = auth.uid());

CREATE POLICY "Service role insert crm_activities" ON public.crm_activities
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ============ CRM SETTINGS ============
CREATE TABLE public.crm_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cooldown_days INTEGER NOT NULL DEFAULT 7,
  default_owner_user_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.crm_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read crm_settings" ON public.crm_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins update crm_settings" ON public.crm_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ MIRROR OUTREACH SENDS INTO CRM TIMELINE ============
CREATE OR REPLACE FUNCTION public.mirror_outreach_to_crm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_contact_id UUID;
  matched_customer_id UUID;
BEGIN
  IF NEW.recipient_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.id, c.customer_id
    INTO matched_contact_id, matched_customer_id
  FROM public.crm_contacts c
  WHERE LOWER(c.email) = LOWER(NEW.recipient_email)
  LIMIT 1;

  IF matched_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.crm_activities (
    customer_id, contact_id, user_id, channel, direction,
    subject, body_excerpt, gmail_message_id, gmail_thread_id, outcome, occurred_at
  ) VALUES (
    matched_customer_id, matched_contact_id, NEW.sent_by, 'email', 'outbound',
    NEW.subject, LEFT(COALESCE(NEW.body, ''), 500),
    NEW.gmail_message_id, NEW.gmail_thread_id, 'sent', NEW.created_at
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_outreach_mirror_to_crm
  AFTER INSERT ON public.outreach_send_log
  FOR EACH ROW EXECUTE FUNCTION public.mirror_outreach_to_crm();
