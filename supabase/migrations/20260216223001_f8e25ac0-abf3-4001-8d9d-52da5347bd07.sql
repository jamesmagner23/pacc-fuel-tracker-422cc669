
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'client');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS on user_roles: users can read their own roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create client_accounts table
CREATE TABLE public.client_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  contact_name text,
  contact_email text NOT NULL,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

-- Admins can do everything on client_accounts
CREATE POLICY "Admins can manage client accounts"
  ON public.client_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Clients can read their own account
CREATE POLICY "Clients can read own account"
  ON public.client_accounts FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Create client_portal_settings table
CREATE TABLE public.client_portal_settings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_account_id bigint REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  weekly_summary_email boolean DEFAULT false,
  monthly_summary_email boolean DEFAULT true,
  delivery_notification boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.client_portal_settings ENABLE ROW LEVEL SECURITY;

-- Clients can read/update their own settings
CREATE POLICY "Clients can manage own settings"
  ON public.client_portal_settings FOR ALL
  TO authenticated
  USING (
    client_account_id IN (
      SELECT id FROM public.client_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- Admins can manage all settings
CREATE POLICY "Admins can manage all settings"
  ON public.client_portal_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy on transactions for clients to see only their own
CREATE POLICY "Clients can view own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    nombre_cliente1 = (
      SELECT company_name FROM public.client_accounts
      WHERE auth_user_id = auth.uid()
    )
  );

-- Function to get company name for authenticated client
CREATE OR REPLACE FUNCTION public.get_client_company_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_name FROM public.client_accounts
  WHERE auth_user_id = _user_id
  LIMIT 1
$$;
