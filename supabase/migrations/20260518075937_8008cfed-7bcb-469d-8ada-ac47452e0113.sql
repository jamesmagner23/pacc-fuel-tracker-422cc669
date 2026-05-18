-- Deactivate the lingering CORE FOUNDATIONS recurring order and remove future scheduled stops
DELETE FROM public.dispatch_stops
WHERE recurring_id = '5b568d55-0f65-4c22-8b10-d5748b560b13'
  AND scheduled_date >= CURRENT_DATE
  AND status <> 'completed';

DELETE FROM public.dispatch_recurring
WHERE id = '5b568d55-0f65-4c22-8b10-d5748b560b13';