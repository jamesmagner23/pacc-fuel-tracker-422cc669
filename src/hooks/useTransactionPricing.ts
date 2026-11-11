import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "./useDemo";
import { getDemoData, DEMO_CLIENT_ACCOUNTS } from "@/data/demoData";
import { createTransactionPricer, type PriceTransaction, type PricingResult } from "@/lib/transactionPricing";
import { melbourneDate } from "@/lib/transactionDates";
import { withTimeout } from "@/lib/requestTimeout";

export function useTransactionPricing(transactions: PriceTransaction[]) {
  const demo = useDemo();
  const ids = useMemo(() => transactions.map(t => t.id).sort((a, b) => a - b), [transactions]);
  const query = useQuery({
    queryKey: ["transaction-sell-pricing", ids, demo], enabled: ids.length > 0, retry: 1,
    queryFn: async () => {
      if (demo) {
        const data = getDemoData();
        const price = createTransactionPricer(data.transactions, DEMO_CLIENT_ACCOUNTS, data.customerPricing, data.buyPrices, melbourneDate());
        return Object.fromEntries(transactions.map(t => [t.id, price(t)])) as Record<number, PricingResult>;
      }
      const output: Record<number, PricingResult> = {};
      for (let i = 0; i < ids.length; i += 500) {
        const { data, error } = await withTimeout(supabase.functions.invoke("transaction-sell-pricing", { body: { ids: ids.slice(i, i + 500) } }), 30_000);
        if (error || data?.error) throw error ?? new Error(data.error);
        Object.assign(output, data?.prices ?? {});
      }
      return output;
    },
  });
  const getTxPricing = (t: PriceTransaction): PricingResult => query.data?.[t.id] ?? {
    hasPricing: (t.ppu ?? 0) > 0 || (t.dinero_total ?? 0) > 0,
    sellPPL: (t.ppu ?? 0) > 0 ? t.ppu ?? null : (t.dinero_total ?? 0) > 0 && (t.cantidad ?? 0) > 0 ? Number(t.dinero_total) / Number(t.cantidad) : null,
    total: (t.dinero_total ?? 0) > 0 ? t.dinero_total ?? null : (t.ppu ?? 0) > 0 ? Number(t.ppu) * (t.cantidad ?? 0) : null,
    source: (t.ppu ?? 0) > 0 || (t.dinero_total ?? 0) > 0 ? "speedsol" : "missing",
  };
  return { ...query, getTxPricing };
}