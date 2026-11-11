CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_lower_date ON public.transactions(lower(nombre_cliente1), date);
CREATE INDEX IF NOT EXISTS idx_dispatch_stops_signed_at ON public.dispatch_stops(signed_at DESC) WHERE signed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispatch_stops_client_date ON public.dispatch_stops(client_account_id, scheduled_date);
CREATE TABLE public.uploaded_dockets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_account_id bigint NOT NULL REFERENCES public.client_accounts(id),
 dispatch_stop_id uuid REFERENCES public.dispatch_stops(id),
 transaction_id integer REFERENCES public.transactions(id),
 docket_date date NOT NULL,
 file_path text NOT NULL UNIQUE,
 file_name text NOT NULL,
 mime_type text NOT NULL,
 litres numeric,
 notes text,
 uploaded_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.uploaded_dockets TO authenticated;
GRANT ALL ON public.uploaded_dockets TO service_role;
ALTER TABLE public.uploaded_dockets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read uploaded dockets" ON public.uploaded_dockets FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));
CREATE POLICY "Staff insert uploaded dockets" ON public.uploaded_dockets FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations')) AND uploaded_by=auth.uid());
CREATE POLICY "Clients read own uploaded dockets" ON public.uploaded_dockets FOR SELECT TO authenticated USING (client_account_id=public.get_user_client_account_id(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_uploaded_dockets_client_date ON public.uploaded_dockets(client_account_id,docket_date DESC);
CREATE TABLE public.docket_archives (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), docket_kind text NOT NULL, docket_id uuid NOT NULL, archived_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(docket_kind,docket_id));
GRANT SELECT, INSERT ON public.docket_archives TO authenticated;
GRANT ALL ON public.docket_archives TO service_role;
ALTER TABLE public.docket_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view docket archives" ON public.docket_archives FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));
CREATE POLICY "Staff archive without changing original records" ON public.docket_archives FOR INSERT TO authenticated WITH CHECK((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations')) AND archived_by=auth.uid());
CREATE OR REPLACE FUNCTION public.validate_uploaded_docket() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.mime_type NOT IN ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif') THEN RAISE EXCEPTION 'Attach a PDF or supported image'; END IF;
 IF NEW.litres IS NOT NULL AND NEW.litres<0 THEN RAISE EXCEPTION 'Litres cannot be negative'; END IF;
 IF split_part(NEW.file_path,'/',1)<>NEW.client_account_id::text THEN RAISE EXCEPTION 'File customer does not match'; END IF;
 IF NEW.dispatch_stop_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.dispatch_stops WHERE id=NEW.dispatch_stop_id AND client_account_id=NEW.client_account_id AND scheduled_date=NEW.docket_date) THEN RAISE EXCEPTION 'Delivery must match customer and date'; END IF;
 IF NEW.transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.transactions t JOIN public.client_accounts c ON c.id=NEW.client_account_id WHERE t.id=NEW.transaction_id AND t.date=NEW.docket_date::text AND (t.nombre_cliente1=c.company_name OR t.nombre_cliente1=c.speedsol_name OR t.nombre_cliente1=ANY(c.speedsol_names))) THEN RAISE EXCEPTION 'Transaction must match customer and date'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_uploaded_docket BEFORE INSERT ON public.uploaded_dockets FOR EACH ROW EXECUTE FUNCTION public.validate_uploaded_docket();
CREATE POLICY "Staff insert signed docket files" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='signed-dockets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations')) AND name ~ '^[0-9]+/[0-9a-f-]+/[^/]+$');
CREATE POLICY "Staff read signed docket files" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='signed-dockets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations')));
CREATE POLICY "Clients read their recorded signed docket files" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='signed-dockets' AND EXISTS(SELECT 1 FROM public.uploaded_dockets d WHERE d.file_path=storage.objects.name AND d.client_account_id=public.get_user_client_account_id(auth.uid())));
CREATE OR REPLACE VIEW public.signed_docket_list WITH(security_invoker=true) AS
 SELECT 'captured'::text AS kind,s.id,s.client_account_id,s.scheduled_date AS docket_date,s.site_name AS title,s.delivered_litres AS litres,s.customer_name,s.signed_at AS recorded_at,NULL::text AS file_path,NULL::text AS file_name,NULL::text AS mime_type
 FROM public.dispatch_stops s WHERE s.signed_at IS NOT NULL
 UNION ALL
 SELECT 'uploaded'::text,d.id,d.client_account_id,d.docket_date,d.file_name,d.litres,NULL::text,d.created_at,d.file_path,d.file_name,d.mime_type FROM public.uploaded_dockets d;
GRANT SELECT ON public.signed_docket_list TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.list_signed_dockets(_client bigint DEFAULT NULL,_from date DEFAULT NULL,_to date DEFAULT NULL) RETURNS SETOF public.signed_docket_list LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE staff boolean := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'); own_client bigint := public.get_user_client_account_id(auth.uid());
BEGIN
 IF NOT staff AND own_client IS NULL THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT l.* FROM public.signed_docket_list l WHERE (staff OR l.client_account_id=own_client) AND (_client IS NULL OR l.client_account_id=_client) AND (_from IS NULL OR l.docket_date>=_from) AND (_to IS NULL OR l.docket_date<=_to) AND NOT EXISTS(SELECT 1 FROM public.docket_archives a WHERE a.docket_kind=l.kind AND a.docket_id=l.id);
END $$;
REVOKE ALL ON FUNCTION public.list_signed_dockets(bigint,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_signed_dockets(bigint,date,date) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.customer_delivery_summary(_from text DEFAULT NULL,_to text DEFAULT NULL) RETURNS TABLE(name text,litres numeric,deliveries bigint,revenue numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations')) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT coalesce(t.nombre_cliente1,'Unknown'),coalesce(sum(t.cantidad),0),count(*),CASE WHEN public.has_role(auth.uid(),'admin') THEN coalesce(sum(t.dinero_total),0) ELSE 0::numeric END FROM public.transactions t WHERE (_from IS NULL OR t.date>=_from) AND (_to IS NULL OR t.date<=_to) GROUP BY t.nombre_cliente1;
END $$;
REVOKE ALL ON FUNCTION public.customer_delivery_summary(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_delivery_summary(text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.admin_user_directory() RETURNS TABLE(id uuid,user_id uuid,role public.app_role,full_name text,email text,client_account_id bigint,company_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT r.id,r.user_id,r.role,r.full_name,coalesce(nullif(u.email,''),nullif(nullif(r.email,'[secure value]'),'')),r.client_account_id,c.company_name FROM public.user_roles r LEFT JOIN auth.users u ON u.id=r.user_id LEFT JOIN public.client_accounts c ON c.id=r.client_account_id ORDER BY r.role,r.full_name;
END $$;
REVOKE ALL ON FUNCTION public.admin_user_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;