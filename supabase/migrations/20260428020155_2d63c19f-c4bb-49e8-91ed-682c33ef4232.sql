CREATE OR REPLACE FUNCTION public.preview_tag_transaction(
  _transaction_id bigint,
  _plant_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plant_name text;
  v_placa text;
  v_count int;
  v_names text[];
  v_backfill int := 0;
BEGIN
  IF _plant_item_id IS NULL THEN
    RETURN jsonb_build_object(
      'plant_item_name', NULL,
      'placa', NULL,
      'conflict', false,
      'conflict_count', 0,
      'conflict_names', '[]'::jsonb,
      'backfill_count', 0
    );
  END IF;

  SELECT name, placa INTO v_plant_name, v_placa
  FROM public.plant_items
  WHERE id = _plant_item_id;

  IF v_placa IS NOT NULL AND length(trim(v_placa)) > 0 THEN
    SELECT count(*), array_agg(name ORDER BY name)
      INTO v_count, v_names
    FROM public.plant_items
    WHERE is_active = true
      AND placa IS NOT NULL
      AND upper(trim(placa)) = upper(trim(v_placa));

    -- Only count backfill candidates when there is no conflict.
    IF COALESCE(v_count, 0) <= 1 THEN
      SELECT count(*) INTO v_backfill
      FROM public.transactions t
      LEFT JOIN public.transaction_overrides o
        ON o.transaction_id = t.id
      WHERE o.transaction_id IS NULL
        AND t.placa IS NOT NULL
        AND upper(trim(t.placa)) = upper(trim(v_placa))
        AND t.id <> _transaction_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'plant_item_name', v_plant_name,
    'placa', v_placa,
    'conflict', COALESCE(v_count, 0) > 1,
    'conflict_count', COALESCE(v_count, 0),
    'conflict_names', to_jsonb(COALESCE(v_names, ARRAY[]::text[])),
    'backfill_count', COALESCE(v_backfill, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_tag_transaction(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_tag_transaction(bigint, uuid) TO authenticated;