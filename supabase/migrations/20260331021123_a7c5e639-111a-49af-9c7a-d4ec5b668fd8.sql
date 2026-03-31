
-- Fix 1: transactions - drop overly permissive public INSERT/UPDATE policies, replace with service_role
DROP POLICY IF EXISTS "Allow service role insert on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow service role update on transactions" ON public.transactions;

CREATE POLICY "Service role insert on transactions"
  ON public.transactions FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update on transactions"
  ON public.transactions FOR UPDATE TO service_role
  USING (true);

-- Fix 2: client_accounts - drop public insert policy
DROP POLICY IF EXISTS "Allow public insert on client_accounts" ON public.client_accounts;
