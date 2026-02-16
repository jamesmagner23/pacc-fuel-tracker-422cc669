
-- Transactions table matching SCA WEB schema
CREATE TABLE public.transactions (
  id integer PRIMARY KEY,
  fecha timestamp with time zone NOT NULL,
  date text,
  estacion text,
  nombre_flota text,
  nombre_cliente1 text,
  identificador_cliente1 text,
  ciudad text,
  cantidad decimal,
  cantidad_neta decimal,
  producto text,
  nombre_vendedor text,
  placa text,
  totalizador_bruto decimal,
  factura integer,
  forma_de_pago text,
  ppu decimal,
  dinero_total decimal,
  id_surtidor integer,
  surtidor text,
  manguera text,
  region text,
  nombre_flota_doc text,
  documento_cliente1 text,
  nombre_vendedor_id text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_transactions_date ON public.transactions (date);
CREATE INDEX idx_transactions_cliente ON public.transactions (nombre_cliente1);
CREATE INDEX idx_transactions_estacion ON public.transactions (estacion);
CREATE INDEX idx_transactions_vendedor ON public.transactions (nombre_vendedor);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on transactions"
  ON public.transactions FOR SELECT USING (true);

CREATE POLICY "Allow service role insert on transactions"
  ON public.transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role update on transactions"
  ON public.transactions FOR UPDATE USING (true);

-- Sync log table
CREATE TABLE public.sync_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  synced_at timestamp with time zone DEFAULT now(),
  records_fetched integer,
  records_upserted integer,
  status text,
  error_message text
);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on sync_log"
  ON public.sync_log FOR SELECT USING (true);

CREATE POLICY "Allow service role insert on sync_log"
  ON public.sync_log FOR INSERT WITH CHECK (true);
