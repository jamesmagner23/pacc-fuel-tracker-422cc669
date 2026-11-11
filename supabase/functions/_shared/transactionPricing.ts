export interface PriceTransaction {
  id: number; fecha: string; date?: string | null; nombre_cliente1?: string | null;
  cantidad?: number | null; ppu?: number | null; dinero_total?: number | null;
}
export interface PricingResult {
  hasPricing: boolean; sellPPL: number | null; total: number | null;
  source: "speedsol" | "calculated" | "missing";
}
export interface PricingTier {
  client_account_id: number; min_litres: number; max_litres: number | null;
  margin_percent: number; pricing_type: string;
}
export interface PricingClient { id: number; company_name: string; speedsol_name?: string | null; speedsol_names?: string[] | null }
export interface HistoricalBuy { price_date: string; price_per_litre: number }

export function effectiveBuyPrice(prices: HistoricalBuy[], date: string, today: string): number | null {
  const valid = prices.filter(p => p.price_per_litre > 0 && p.price_date <= today)
    .sort((a, b) => b.price_date.localeCompare(a.price_date) || a.price_per_litre - b.price_per_litre);
  return (valid.find(p => p.price_date <= date) ?? valid[0])?.price_per_litre ?? null;
}

export function createTransactionPricer(transactions: PriceTransaction[], clients: PricingClient[], tiers: PricingTier[], buys: HistoricalBuy[], today: string) {
  const names = new Map<string, number>();
  clients.forEach(c => [c.company_name, c.speedsol_name, ...(c.speedsol_names ?? [])].forEach(n => {
    if (n) names.set(n.trim().toLowerCase(), c.id);
  }));
  const weekKey = (t: PriceTransaction) => {
    const d = new Date(`${t.date || t.fecha.slice(0, 10)}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    return d.toISOString().slice(0, 10);
  };
  const volumes = new Map<string, number>();
  const seen = new Set<number>();
  transactions.forEach(t => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    const client = names.get((t.nombre_cliente1 ?? "").trim().toLowerCase());
    if (client == null) return;
    const key = `${client}:${weekKey(t)}`;
    volumes.set(key, (volumes.get(key) ?? 0) + (t.cantidad ?? 0));
  });
  return (t: PriceTransaction): PricingResult => {
    const litres = t.cantidad ?? 0;
    if ((t.dinero_total ?? 0) > 0) return { hasPricing: true, sellPPL: (t.ppu ?? 0) > 0 ? t.ppu ?? null : litres > 0 ? Number(t.dinero_total) / litres : null, total: Number(t.dinero_total), source: "speedsol" };
    if ((t.ppu ?? 0) > 0) return { hasPricing: true, sellPPL: Number(t.ppu), total: litres * Number(t.ppu), source: "speedsol" };
    const client = names.get((t.nombre_cliente1 ?? "").trim().toLowerCase());
    const volume = client == null ? 0 : volumes.get(`${client}:${weekKey(t)}`) ?? 0;
    const clientTiers = tiers.filter(p => p.client_account_id === client).sort((a, b) => b.min_litres - a.min_litres);
    // Reuse the existing Client Pricing walk-down: highest eligible minimum,
    // including the highest configured tier for volumes above its upper label.
    const tier = clientTiers.find(p => volume >= p.min_litres) ?? clientTiers[clientTiers.length - 1];
    const buy = effectiveBuyPrice(buys, t.date || t.fecha.slice(0, 10), today);
    if (!tier || buy == null) return { hasPricing: false, sellPPL: null, total: null, source: "missing" };
    // Preserve Client Pricing's existing formula: markup is cents/L, margin is percentage added to buy.
    const sellPPL = tier.pricing_type === "markup" ? buy + tier.margin_percent / 100 : buy * (1 + tier.margin_percent / 100);
    if (!(sellPPL > 0)) return { hasPricing: false, sellPPL: null, total: null, source: "missing" };
    return { hasPricing: true, sellPPL, total: litres * sellPPL, source: "calculated" };
  };
}

export function pricingCoverage(transactions: PriceTransaction[], price: (t: PriceTransaction) => PricingResult) {
  let revenue = 0, pricedLitres = 0, unpricedLitres = 0;
  const customers = new Set<string>();
  transactions.forEach(t => {
    const p = price(t), litres = t.cantidad ?? 0;
    if (p.hasPricing) { revenue += p.total ?? 0; pricedLitres += litres; }
    else { unpricedLitres += litres; customers.add(t.nombre_cliente1 ?? "Unknown"); }
  });
  return { revenue, pricedLitres, unpricedLitres, unpricedCustomers: customers.size, ratesMissing: revenue === 0 || unpricedLitres > 0 };
}

export function safeDelta(current: number, previous: number): number | null {
  return current === 0 || previous === 0 || !Number.isFinite(current) || !Number.isFinite(previous) ? null : (current - previous) / Math.abs(previous) * 100;
}

export function customerPricingSummaries(transactions: PriceTransaction[], price: (t: PriceTransaction) => PricingResult) {
  const rows = new Map<string, { name: string; litres: number; deliveries: number; revenue: number | null; unpricedLitres: number; calculated: boolean }>();
  for (const t of transactions) {
    const name = t.nombre_cliente1 || "Unknown";
    const row = rows.get(name) ?? { name, litres: 0, deliveries: 0, revenue: null, unpricedLitres: 0, calculated: false };
    const p = price(t);
    row.litres += t.cantidad ?? 0;
    row.deliveries++;
    if (p.hasPricing) row.revenue = (row.revenue ?? 0) + (p.total ?? 0);
    else row.unpricedLitres += t.cantidad ?? 0;
    row.calculated ||= p.source === "calculated";
    rows.set(name, row);
  }
  return [...rows.values()];
}