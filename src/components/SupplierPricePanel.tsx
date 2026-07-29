import { useMemo } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Fuel } from "lucide-react";
import { useBuyPrices, SUPPLIERS } from "@/hooks/useBuyPrices";

/**
 * Latest buy price per supplier (inc GST), with movement vs the prior
 * recorded price for that same supplier. Cheapest supplier is flagged.
 */
export function SupplierPricePanel({ compact = false }: { compact?: boolean }) {
  const { data: prices = [], isLoading } = useBuyPrices(60);

  const cards = useMemo(() => {
    const names = Array.from(new Set([...SUPPLIERS, ...prices.map((p) => p.supplier)]));
    return names
      .map((supplier) => {
        const rows = prices
          .filter((p) => p.supplier === supplier)
          .sort((a, b) => b.price_date.localeCompare(a.price_date));
        const latest = rows[0];
        const prior = rows.find((r) => r.price_date < (latest?.price_date || ""));
        const delta = latest && prior ? latest.price_per_litre - prior.price_per_litre : null;
        return { supplier, latest, delta };
      })
      .filter((c) => c.latest);
  }, [prices]);

  const cheapest = cards.reduce<typeof cards[number] | null>(
    (best, c) => (!best || c.latest!.price_per_litre < best.latest!.price_per_litre ? c : best),
    null,
  );

  return (
    <div className="bg-card border border-border rounded-[14px] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">What we're buying at</h2>
        </div>
        <Link to="/suppliers" className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
          Suppliers →
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No supply prices recorded yet.</div>
      ) : (
        <div className={`grid gap-3 mt-4 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
          {cards.map((c) => {
            const isCheapest = cheapest?.supplier === c.supplier && cards.length > 1;
            return (
              <div
                key={c.supplier}
                className="rounded-[12px] border border-border bg-muted/40 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{c.supplier}</span>
                  {isCheapest && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                      Cheapest
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    ${c.latest!.price_per_litre.toFixed(3)}
                  </span>
                  <span className="text-[13px] font-medium text-muted-foreground">/L inc GST</span>
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {format(parseISO(c.latest!.price_date), "EEE d MMM")}
                  {c.delta != null && (
                    <>
                      {" · "}
                      <span className={c.delta > 0 ? "text-destructive" : c.delta < 0 ? "text-positive" : ""}>
                        {c.delta > 0 ? "+" : ""}{(c.delta * 100).toFixed(2)}c
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
