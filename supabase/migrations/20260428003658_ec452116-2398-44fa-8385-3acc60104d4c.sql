-- ============================================================
-- Auto-tag transactions by placa once a plant item is identified
-- ============================================================

-- 1. When an override sets a plant_item_id, learn the placa for that
--    plant item and backfill prior untagged transactions with the same placa.
CREATE OR REPLACE FUNCTION public.learn_plant_placa_from_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn_placa TEXT;
  current_placa TEXT;
BEGIN
  -- Only act if an override now points to a plant item
  IF NEW.plant_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pull the placa from the source transaction
  SELECT NULLIF(TRIM(t.placa), '') INTO txn_placa
  FROM public.transactions t
  WHERE t.id = NEW.transaction_id;

  IF txn_placa IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read the plant item's current placa
  SELECT NULLIF(TRIM(placa), '') INTO current_placa
  FROM public.plant_items
  WHERE id = NEW.plant_item_id;

  -- Teach the plant item its placa if not already set
  IF current_placa IS NULL THEN
    UPDATE public.plant_items
       SET placa = txn_placa, updated_at = now()
     WHERE id = NEW.plant_item_id;
  ELSIF LOWER(current_placa) <> LOWER(txn_placa) THEN
    -- The plant item has a different placa already — don't overwrite.
    -- Skip backfill to avoid mistagging.
    RETURN NEW;
  END IF;

  -- Backfill: auto-tag every other transaction with this placa that
  -- does not already have an override. Project intentionally left null
  -- (drivers/admins assign per-drop because plant moves between projects).
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
$$;

DROP TRIGGER IF EXISTS trg_learn_plant_placa ON public.transaction_overrides;
CREATE TRIGGER trg_learn_plant_placa
AFTER INSERT OR UPDATE OF plant_item_id ON public.transaction_overrides
FOR EACH ROW
EXECUTE FUNCTION public.learn_plant_placa_from_override();


-- 2. When a new transaction comes in, auto-tag it if its placa is
--    already known on a plant item.
CREATE OR REPLACE FUNCTION public.auto_tag_transaction_by_placa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_id UUID;
  txn_placa TEXT;
BEGIN
  txn_placa := NULLIF(TRIM(NEW.placa), '');
  IF txn_placa IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find a plant item with this placa (case-insensitive). If multiple
  -- items share a placa, do nothing — humans should resolve it.
  SELECT id INTO match_id
  FROM public.plant_items
  WHERE LOWER(TRIM(placa)) = LOWER(txn_placa)
    AND is_active = true
  LIMIT 2;

  IF match_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Re-check uniqueness
  IF (SELECT COUNT(*) FROM public.plant_items
      WHERE LOWER(TRIM(placa)) = LOWER(txn_placa) AND is_active = true) > 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.transaction_overrides (transaction_id, plant_item_id, notes)
  VALUES (NEW.id, match_id, 'Auto-tagged on import')
  ON CONFLICT (transaction_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_tag_txn ON public.transactions;
CREATE TRIGGER trg_auto_tag_txn
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_tag_transaction_by_placa();