-- Scheduled deliveries table
CREATE TABLE IF NOT EXISTS public.scheduled_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id bigint REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  scheduled_date date NOT NULL,
  estimated_litres numeric,
  notes text,
  status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scheduled_deliveries ENABLE ROW LEVEL SECURITY;

-- Security definer function: check if user belongs to a client account
CREATE OR REPLACE FUNCTION public.get_user_client_account_id(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_account_id FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Security definer: check if user's client has a specific speedsol name
CREATE OR REPLACE FUNCTION public.user_owns_speedsol_name(_user_id uuid, _name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.client_accounts ca ON ca.id = ur.client_account_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'client'
      AND _name = ANY(ca.speedsol_names)
  )
$$;

-- Admin full access on scheduled_deliveries
CREATE POLICY "Admin full access on scheduled_deliveries"
ON public.scheduled_deliveries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Clients read own scheduled deliveries
CREATE POLICY "Clients read own scheduled deliveries"
ON public.scheduled_deliveries
FOR SELECT
TO authenticated
USING (client_account_id = public.get_user_client_account_id(auth.uid()));

-- Clients read own transactions (via speedsol_names mapping)
CREATE POLICY "Clients read own txns via speedsol"
ON public.transactions
FOR SELECT
TO authenticated
USING (public.user_owns_speedsol_name(auth.uid(), nombre_cliente1));

-- Drop old duplicate client_accounts policy before creating new one
DROP POLICY IF EXISTS "Clients can read own account" ON public.client_accounts;

-- Clients read own client account
CREATE POLICY "Clients read own account via role"
ON public.client_accounts
FOR SELECT
TO authenticated
USING (id = public.get_user_client_account_id(auth.uid()));