
-- 1. Fix buy_prices: drop public policies, add admin-only
DROP POLICY IF EXISTS "Allow public delete on buy_prices" ON buy_prices;
DROP POLICY IF EXISTS "Allow public insert on buy_prices" ON buy_prices;
DROP POLICY IF EXISTS "Allow public read access on buy_prices" ON buy_prices;
DROP POLICY IF EXISTS "Allow public update on buy_prices" ON buy_prices;

CREATE POLICY "Admins manage buy prices"
  ON buy_prices FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix pricing_tiers: drop public policies, add admin-only
DROP POLICY IF EXISTS "Allow public delete on pricing_tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Allow public insert on pricing_tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Allow public read on pricing_tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Allow public update on pricing_tiers" ON pricing_tiers;

CREATE POLICY "Admins manage pricing tiers"
  ON pricing_tiers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix quotes: drop public policies, add admin-only
DROP POLICY IF EXISTS "Allow public delete on quotes" ON quotes;
DROP POLICY IF EXISTS "Allow public insert on quotes" ON quotes;
DROP POLICY IF EXISTS "Allow public read on quotes" ON quotes;
DROP POLICY IF EXISTS "Allow public update on quotes" ON quotes;

CREATE POLICY "Admins manage quotes"
  ON quotes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Fix customer_pricing: drop public policies, add admin-only + client read own
DROP POLICY IF EXISTS "Allow public delete on customer_pricing" ON customer_pricing;
DROP POLICY IF EXISTS "Allow public insert on customer_pricing" ON customer_pricing;
DROP POLICY IF EXISTS "Allow public read on customer_pricing" ON customer_pricing;
DROP POLICY IF EXISTS "Allow public update on customer_pricing" ON customer_pricing;

CREATE POLICY "Admins manage customer pricing"
  ON customer_pricing FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients read own pricing"
  ON customer_pricing FOR SELECT
  TO authenticated
  USING (client_account_id = get_user_client_account_id(auth.uid()));

-- 5. Fix sync_log: drop public read, add admin-only read
DROP POLICY IF EXISTS "Allow public read access on sync_log" ON sync_log;
DROP POLICY IF EXISTS "Allow service role insert on sync_log" ON sync_log;

CREATE POLICY "Admins read sync log"
  ON sync_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role insert sync log"
  ON sync_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 6. Fix user_roles: add admin SELECT all + admin manage
CREATE POLICY "Admins view all user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage user roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
