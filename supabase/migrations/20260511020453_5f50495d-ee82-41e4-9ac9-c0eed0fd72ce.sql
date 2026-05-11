
CREATE POLICY "Operations manage client_accounts" ON public.client_accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'operations'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operations'::app_role));

CREATE POLICY "Operations manage plant_items" ON public.plant_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'operations'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operations'::app_role));

CREATE POLICY "Operations manage projects" ON public.projects
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'operations'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operations'::app_role));

CREATE POLICY "Operations manage transaction_overrides" ON public.transaction_overrides
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'operations'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operations'::app_role));

CREATE POLICY "Operations manage dispatch_stops" ON public.dispatch_stops
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'operations'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operations'::app_role));
