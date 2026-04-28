-- RPC: check whether tagging to a given plant_item would hit a rego conflict
CREATE OR REPLACE FUNCTION public.check_plant_rego_conflict(_plant_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_placa text;
  v_count int;
  v_names text[];
BEGIN
  IF _plant_item_id IS NULL THEN
    RETURN jsonb_build_object('conflict', false, 'placa', NULL, 'count', 0, 'names', '[]'::jsonb);
  END IF;

  SELECT placa INTO v_placa
  FROM public.plant_items
  WHERE id = _plant_item_id;

  IF v_placa IS NULL OR length(trim(v_placa)) = 0 THEN
    RETURN jsonb_build_object('conflict', false, 'placa', NULL, 'count', 0, 'names', '[]'::jsonb);
  END IF;

  SELECT count(*), array_agg(name ORDER BY name)
    INTO v_count, v_names
  FROM public.plant_items
  WHERE is_active = true
    AND placa IS NOT NULL
    AND upper(trim(placa)) = upper(trim(v_placa));

  RETURN jsonb_build_object(
    'conflict', v_count > 1,
    'placa', v_placa,
    'count', COALESCE(v_count, 0),
    'names', to_jsonb(COALESCE(v_names, ARRAY[]::text[]))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_plant_rego_conflict(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_plant_rego_conflict(uuid) TO authenticated;