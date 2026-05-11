CREATE POLICY "Operations manage project_plant_assignments"
ON public.project_plant_assignments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'operations'::app_role))
WITH CHECK (has_role(auth.uid(), 'operations'::app_role));

CREATE POLICY "Operations manage plant_assignment_audit"
ON public.plant_assignment_audit
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'operations'::app_role))
WITH CHECK (has_role(auth.uid(), 'operations'::app_role));