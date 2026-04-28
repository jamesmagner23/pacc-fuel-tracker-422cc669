-- 1) RPC: resolve a tag and return rich result (plant name, backfill count, conflict flag)
CREATE OR REPLACE FUNCTION public.tag_transaction_with_feedback(
  _transaction_id integer,
  _plant_item_id uuid,
  _project_id uuid,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean := has_role(uid, 'admin');
  is_driver boolean := has_role(uid, 'driver');
  txn_placa text;
  plant_name text;
  plant_current_placa text;
  conflict_count int := 0;
  backfill_count int := 0;
BEGIN
  IF NOT (is_admin OR is_driver) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Pull source transaction placa for messaging / conflict check
  SELECT NULLIF(TRIM(t.placa), '') INTO txn_placa
  FROM public.transactions t WHERE t.id = _transaction_id;

  -- Resolve plant name (if assigning one)
  IF _plant_item_id IS NOT NULL THEN
    SELECT name, NULLIF(TRIM(placa), '') INTO plant_name, plant_current_placa
    FROM public.plant_items WHERE id = _plant_item_id;

    -- Conflict: placa already used by another active plant item
    IF txn_placa IS NOT NULL THEN
      SELECT COUNT(*) INTO conflict_count
      FROM public.plant_items
      WHERE LOWER(TRIM(placa)) = LOWER(txn_placa)
        AND is_active = true
        AND id <> _plant_item_id;
    END IF;
  END IF;

  -- Upsert override (existing learn trigger fires and handles backfill)
  INSERT INTO public.transaction_overrides
    (transaction_id, plant_item_id, project_id, set_by, notes)
  VALUES
    (_transaction_id, _plant_item_id, _project_id, uid, _notes)
  ON CONFLICT (transaction_id) DO UPDATE
  SET plant_item_id = EXCLUDED.plant_item_id,
      project_id    = EXCLUDED.project_id,
      notes         = EXCLUDED.notes,
      set_by        = EXCLUDED.set_by,
      updated_at    = now();

  -- Count auto-backfilled rows (those that just got tagged with this plant via 'Auto-tagged by placa match')
  IF _plant_item_id IS NOT NULL AND txn_placa IS NOT NULL AND conflict_count = 0 THEN
    SELECT COUNT(*) INTO backfill_count
    FROM public.transaction_overrides ov
    JOIN public.transactions t ON t.id = ov.transaction_id
    WHERE ov.plant_item_id = _plant_item_id
      AND ov.transaction_id <> _transaction_id
      AND LOWER(TRIM(t.placa)) = LOWER(txn_placa)
      AND ov.notes = 'Auto-tagged by placa match';
  END IF;

  RETURN jsonb_build_object(
    'plant_item_name', plant_name,
    'placa', txn_placa,
    'backfill_count', backfill_count,
    'conflict', conflict_count > 0
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tag_transaction_with_feedback(integer, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tag_transaction_with_feedback(integer, uuid, uuid, text) TO authenticated;

-- 2) RPC: list rego conflicts (admin only)
CREATE OR REPLACE FUNCTION public.list_rego_conflicts()
RETURNS TABLE (
  placa text,
  plant_items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH active AS (
    SELECT id, name, client_account_id, placa, equipment_type, is_active
    FROM public.plant_items
    WHERE is_active = true AND NULLIF(TRIM(placa), '') IS NOT NULL
  ),
  grouped AS (
    SELECT LOWER(TRIM(a.placa)) AS pkey,
           MIN(a.placa) AS placa_display,
           COUNT(*) AS cnt
    FROM active a
    GROUP BY LOWER(TRIM(a.placa))
    HAVING COUNT(*) > 1
  )
  SELECT g.placa_display AS placa,
    jsonb_agg(jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'client_account_id', a.client_account_id,
      'equipment_type', a.equipment_type,
      'placa', a.placa
    ) ORDER BY a.name) AS plant_items
  FROM grouped g
  JOIN active a ON LOWER(TRIM(a.placa)) = g.pkey
  GROUP BY g.placa_display
  ORDER BY g.placa_display;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_rego_conflicts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_rego_conflicts() TO authenticated;