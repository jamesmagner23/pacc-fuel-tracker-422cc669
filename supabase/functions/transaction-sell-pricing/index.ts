import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { createTransactionPricer } from '../_shared/transactionPricing.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !secret) return json({ error: 'Service unavailable' }, 500);
    const header = req.headers.get('Authorization');
    if (!header?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const scoped = createClient(url, anon, { global: { headers: { Authorization: header } } });
    const { data: claims, error: authError } = await scoped.auth.getClaims(header.slice(7));
    if (authError || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
    const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }).safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Provide between 1 and 500 transaction IDs' }, 400);
    // RLS decides which requested transactions this caller may see.
    const { data: visible, error: visibleError } = await scoped.from('transactions').select('id,fecha,date,nombre_cliente1,cantidad,ppu,dinero_total').in('id', parsed.data.ids);
    if (visibleError) return json({ error: 'Unable to load transactions' }, 500);
    if (!visible?.length) return json({ prices: {} });
    const admin = createClient(url, secret);
    const names = [...new Set(visible.map(t => t.nombre_cliente1).filter(Boolean))];
    const dates = visible.map(t => t.date || t.fecha.slice(0, 10)).sort();
    const first = new Date(`${dates[0]}T12:00:00Z`), last = new Date(`${dates[dates.length - 1]}T12:00:00Z`);
    first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
    last.setUTCDate(last.getUTCDate() + 6 - (last.getUTCDay() + 6) % 7);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [clientResult, tierResult] = await Promise.all([
      admin.from('client_accounts').select('id,company_name,speedsol_name,speedsol_names'),
      admin.from('customer_pricing').select('client_account_id,min_litres,max_litres,margin_percent,pricing_type'),
    ]);
    if (clientResult.error || tierResult.error) return json({ error: 'Unable to load pricing rules' }, 500);
    const weekly = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from('transactions').select('id,fecha,date,nombre_cliente1,cantidad,ppu,dinero_total')
        .in('nombre_cliente1', names).gte('date', first.toISOString().slice(0, 10)).lte('date', last.toISOString().slice(0, 10))
        .order('id').range(offset, offset + 999);
      if (error) return json({ error: 'Unable to load weekly volumes' }, 500);
      weekly.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    const buys = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from('buy_prices').select('price_date,price_per_litre').lte('price_date', today).order('price_date', { ascending: false }).order('id').range(offset, offset + 999);
      if (error) return json({ error: 'Unable to load historical pricing' }, 500);
      buys.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    const price = createTransactionPricer(weekly, clientResult.data ?? [], tierResult.data ?? [], buys, today);
    // Never return buy prices, suppliers, tiers or other customers' rows.
    return json({ prices: Object.fromEntries(visible.map(t => [t.id, price(t)])) });
  } catch {
    return json({ error: 'Pricing request failed. Please retry.' }, 500);
  }
});