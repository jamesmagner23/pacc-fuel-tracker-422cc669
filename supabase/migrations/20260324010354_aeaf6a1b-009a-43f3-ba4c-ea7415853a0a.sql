-- Remove overly permissive public SELECT on transactions (allows all users to see everything)
DROP POLICY IF EXISTS "Allow public read access on transactions" ON transactions;

-- Keep the authenticated policies that properly restrict access:
-- "Clients can view own transactions" and "Clients read own txns via speedsol" already exist

-- Add admin full access policy so admins can still see all transactions
CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Also fix client_accounts: remove overly permissive public SELECT
DROP POLICY IF EXISTS "Allow public read on client_accounts" ON client_accounts;