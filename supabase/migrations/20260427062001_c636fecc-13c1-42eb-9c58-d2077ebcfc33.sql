CREATE TABLE public.operating_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','fortnightly','monthly','quarterly','annual','one_off')),
  next_due_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage operating expenses"
ON public.operating_expenses
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_operating_expenses_updated_at
BEFORE UPDATE ON public.operating_expenses
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_operating_expenses_active_due
  ON public.operating_expenses (is_active, next_due_date);