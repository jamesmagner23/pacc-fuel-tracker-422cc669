ALTER TABLE public.pump_readings ADD COLUMN IF NOT EXISTS truck text NOT NULL DEFAULT 'PACC Truck 1';
CREATE INDEX IF NOT EXISTS idx_pump_readings_truck ON public.pump_readings(truck);