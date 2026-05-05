-- 1) Make the learn/backfill trigger skip backfill when session flag is set
CREATE OR REPLACE FUNCTION public.learn_plant_placa_from_override()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  txn_placa TEXT;
  current_placa TEXT;
  skip_backfill BOOLEAN := false;
BEGIN
  IF NEW.plant_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    skip_backfill := COALESCE(current_setting('app.skip_backfill', true), 'off') = 'on';
  EXCEPTION WHEN OTHERS THEN
    skip_backfill := false;
  END;

  SELECT NULLIF(TRIM(t.placa), '') INTO txn_placa
  FROM public.transactions t
  WHERE t.id = NEW.transaction_id;

  IF txn_placa IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(placa), '') INTO current_placa
  FROM public.plant_items
  WHERE id = NEW.plant_item_id;

  IF current_placa IS NULL AND NOT skip_backfill THEN
    UPDATE public.plant_items
       SET placa = txn_placa, updated_at = now()
     WHERE id = NEW.plant_item_id;
  ELSIF current_placa IS NOT NULL AND LOWER(current_placa) <> LOWER(txn_placa) THEN
    RETURN NEW;
  END IF;

  IF skip_backfill THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.transaction_overrides (transaction_id, plant_item_id, set_by, notes)
  SELECT t.id, NEW.plant_item_id, NEW.set_by, 'Auto-tagged by placa match'
    FROM public.transactions t
   WHERE LOWER(TRIM(t.placa)) = LOWER(txn_placa)
     AND t.id <> NEW.transaction_id
     AND NOT EXISTS (
       SELECT 1 FROM public.transaction_overrides ov WHERE ov.transaction_id = t.id
     )
  ON CONFLICT (transaction_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2) Single-tag RPC: tag one delivery only, never backfill siblings
CREATE OR REPLACE FUNCTION public.tag_transaction_single(
  _transaction_id integer,
  _plant_item_id uuid,
  _project_id uuid,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean := has_role(uid, 'admin');
  is_driver boolean := has_role(uid, 'driver');
  plant_name text;
  txn_placa text;
BEGIN
  IF NOT (is_admin OR is_driver) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  PERFORM set_config('app.skip_backfill', 'on', true);

  SELECT NULLIF(TRIM(t.placa), '') INTO txn_placa FROM public.transactions t WHERE t.id = _transaction_id;
  IF _plant_item_id IS NOT NULL THEN
    SELECT name INTO plant_name FROM public.plant_items WHERE id = _plant_item_id;
  END IF;

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

  PERFORM set_config('app.skip_backfill', 'off', true);

  RETURN jsonb_build_object(
    'plant_item_name', plant_name,
    'placa', txn_placa,
    'backfill_count', 0,
    'conflict', false
  );
END;
$$;

-- 3) Clear all auto-backfilled siblings for one plant item (keeps manual tags)
CREATE OR REPLACE FUNCTION public.clear_auto_backfill_for_plant(_plant_item_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  removed int;
BEGIN
  IF NOT (has_role(uid, 'admin') OR has_role(uid, 'driver')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  WITH del AS (
    DELETE FROM public.transaction_overrides
     WHERE plant_item_id = _plant_item_id
       AND notes = 'Auto-tagged by placa match'
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM del;

  RETURN COALESCE(removed, 0);
END;
$$;