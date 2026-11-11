import { useMemo, useCallback } from "react";
import { useTransactionPricing } from "./useTransactionPricing";
import { pricingCoverage } from "@/lib/transactionPricing";
import { useQuery } from "@tanstack/react-query";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { useCustomerPricing } from "@/hooks/useCustomerPricing";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/hooks/useDemo";
import { DEMO_CLIENT_ACCOUNTS } from "@/data/demoData";

/**
 * Shared revenue calculator. Used by Overview and Finance so both tabs
 * report identical numbers. Revenue falls back through (in order):
 *   1. `dinero_total` recorded on the transaction
 *   2. `cantidad * ppu` if a per-unit price was captured at the pump
 *   3. `cantidad * tier sell price` from Client Pricing rules
 * Transactions that match none of the above are unpriced and excluded.
 */
export function useRevenueCalc(range: "today" | "week" | "month" | string) {
  const { data: filtered = [], isLoading } = useTransactions(range as any);
  const { data: previous = [] } = usePreviousTransactions(range as any);
  const { data: buyPrices = [] } = useBuyPrices(365);
  const { data: customerPricing = [] } = useCustomerPricing();
  const isDemo = useDemo();

  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts", isDemo],
    queryFn: async () => {
      if (isDemo) {
        return DEMO_CLIENT_ACCOUNTS.map((c) => ({
          id: c.id,
          company_name: c.company_name,
          speedsol_name: c.speedsol_name,
          speedsol_names: c.speedsol_names,
        }));
      }
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, speedsol_name, speedsol_names")
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  const latestBuyPrice = buyPrices[0]?.price_per_litre || 0;

  const speedsolToClientId = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c: any) => {
      const names: string[] = c.speedsol_names || [];
      names.forEach((n: string) => { if (n) map.set(n.toLowerCase(), c.id); });
      if (c.speedsol_name) map.set(c.speedsol_name.toLowerCase(), c.id);
      map.set(c.company_name.toLowerCase(), c.id);
    });
    return map;
  }, [clients]);

  const pricing = useTransactionPricing(useMemo(() => [...filtered, ...previous], [filtered, previous]));
  const getTxPricing = pricing.getTxPricing;
  const current = pricingCoverage(filtered, getTxPricing);
  const prev = pricingCoverage(previous, getTxPricing);

  return {
    filtered,
    previous,
    isLoading: isLoading || pricing.isLoading,
    pricingError: pricing.error,
    unpricedLitres: current.unpricedLitres,
    unpricedCustomers: current.unpricedCustomers,
    ratesMissing: current.ratesMissing,
    latestBuyPrice,
    customerPricing,
    clients,
    speedsolToClientId,
    getTxPricing,
    totalRevenue: current.revenue,
    pricedLitres: current.pricedLitres,
    prevRevenue: prev.revenue,
    prevPricedLitres: prev.pricedLitres,
  };
}