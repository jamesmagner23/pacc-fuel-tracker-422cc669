
CREATE OR REPLACE FUNCTION public.expand_dispatch_recurring(_days_ahead int DEFAULT 14)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  d date;
  inserted_count int := 0;
  dow int;
  should_create boolean;
BEGIN
  FOR r IN
    SELECT * FROM public.dispatch_recurring
    WHERE is_active = true
      AND start_date <= CURRENT_DATE + _days_ahead
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LOOP
    d := GREATEST(r.start_date, CURRENT_DATE);
    WHILE d <= CURRENT_DATE + _days_ahead LOOP
      EXIT WHEN r.end_date IS NOT NULL AND d > r.end_date;
      dow := EXTRACT(DOW FROM d)::int; -- 0=Sun..6=Sat
      should_create := false;
      IF r.frequency = 'daily' THEN
        should_create := true;
      ELSIF r.frequency = 'weekdays' THEN
        should_create := dow BETWEEN 1 AND 5;
      ELSIF r.frequency = 'weekly' THEN
        should_create := dow = ANY(r.weekdays);
      END IF;

      IF should_create AND NOT EXISTS (
        SELECT 1 FROM public.dispatch_stops
        WHERE recurring_id = r.id AND scheduled_date = d
      ) THEN
        INSERT INTO public.dispatch_stops (
          scheduled_date, client_account_id, project_id, truck_id,
          site_name, address, estimated_litres, notes,
          recurring_id, status, created_by
        ) VALUES (
          d, r.client_account_id, r.project_id, r.truck_id,
          r.site_name, r.address, r.estimated_litres, r.notes,
          r.id, 'scheduled', r.created_by
        );
        inserted_count := inserted_count + 1;
      END IF;

      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
