-- Add columns to user_roles (client_accounts.id is bigint, not uuid)
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS client_account_id bigint REFERENCES public.client_accounts(id),
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text;