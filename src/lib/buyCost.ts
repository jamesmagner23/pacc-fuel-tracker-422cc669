import type { BuyPrice } from "@/hooks/useBuyPrices";

/**
 * Build a date -> cheapest recorded buy price ($/L inc GST) lookup.
 * Falls back to the most recent price on or before the requested date so
 * older deliveries still cost out sensibly.
 */
export function buildBuyPriceLookup(prices: BuyPrice[]) {
  const cheapestByDate = new Map<string, number>();
  prices.forEach((p) => {
    const current = cheapestByDate.get(p.price_date);
    if (current == null || p.price_per_litre < current) {
      cheapestByDate.set(p.price_date, p.price_per_litre);
    }
  });
  const dates = Array.from(cheapestByDate.keys()).sort();

  return (date?: string | null): number | null => {
    if (!date) return null;
    const exact = cheapestByDate.get(date);
    if (exact != null) return exact;
    let best: string | null = null;
    for (const d of dates) {
      if (d <= date) best = d;
      else break;
    }
    if (best) return cheapestByDate.get(best) ?? null;
    return dates.length ? cheapestByDate.get(dates[0]) ?? null : null;
  };
}

/** Total fuel cost for a set of transactions using date-matched buy prices. */
export function sumBuyCost(
  txns: Array<{ date?: string | null; cantidad?: number | null }>,
  lookup: (date?: string | null) => number | null,
): number {
  return txns.reduce((sum, t) => {
    const ppl = lookup(t.date);
    return ppl != null ? sum + (t.cantidad || 0) * ppl : sum;
  }, 0);
}
