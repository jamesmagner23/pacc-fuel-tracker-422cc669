import { useMemo, useCallback } from "react";
import { getISOWeek } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useTransactions, usePreviousTransactions } from "@/hooks/useTransactions";
import { useBuyPrices } from "@/hooks/useBuyPrices";
import { useCustomerPricing, findTierForVolume } from "@/hooks/useCustomerPricing";
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

  const clientWeeklyVolumes = useMemo(() => {
    const clientWeeks = new Map<number, Map<string, number>>();
    const allTxs = [...filtered, ...previous];
    allTxs.forEach((t: any) => {
      const clientId = speedsolToClientId.get((t.nombre_cliente1 || "").toLowerCase());
      if (!clientId) return;
      const txDate = t.fecha ? new Date(t.fecha) : null;
      if (!txDate) return;
      const weekKey = `${txDate.getFullYear()}-W${getISOWeek(txDate)}`;
      if (!clientWeeks.has(clientId)) clientWeeks.set(clientId, new Map());
      const weeks = clientWeeks.get(clientId)!;
      weeks.set(weekKey, (weeks.get(weekKey) || 0) + (t.cantidad || 0));
    });
    const result = new Map<number, number>();
    clientWeeks.forEach((weeks, clientId) => {
      const totalLitres = Array.from(weeks.values()).reduce((s, v) => s + v, 0);
      const numWeeks = weeks.size || 1;
      result.set(clientId, totalLitres / numWeeks);
    });
    return result;
  }, [filtered, previous, speedsolToClientId]);

  const getTxPricing = useCallback((t: any) => {
    if (t.ppu && t.ppu > 0) return { hasPricing: true, sellPPL: t.ppu };
    const clientId = speedsolToClientId.get((t.nombre_cliente1 || "").toLowerCase());
    if (!clientId) return { hasPricing: false, sellPPL: 0 };
    const weeklyVol = clientWeeklyVolumes.get(clientId) || 0;
    const tier = findTierForVolume(customerPricing, clientId, weeklyVol);
    if (!tier) return { hasPricing: false, sellPPL: 0 };
    const sell = tier.pricing_type === "markup"
      ? latestBuyPrice + tier.margin_percent / 100
      : latestBuyPrice * (1 + tier.margin_percent / 100);
    return { hasPricing: true, sellPPL: sell };
  }, [speedsolToClientId, customerPricing, latestBuyPrice, clientWeeklyVolumes]);

  const sumRevenue = (txs: any[]) => {
    let revenue = 0;
    let pricedLitres = 0;
    txs.forEach((t) => {
      const litres = t.cantidad || 0;
      const { hasPricing, sellPPL } = getTxPricing(t);
      if (t.dinero_total && t.dinero_total > 0) {
        revenue += t.dinero_total;
        if (hasPricing) pricedLitres += litres;
      } else if (hasPricing) {
        revenue += litres * sellPPL;
        pricedLitres += litres;
      }
    });
    return { revenue, pricedLitres };
  };

  const current = useMemo(() => sumRevenue(filtered), [filtered, getTxPricing]);
  const prev = useMemo(() => sumRevenue(previous), [previous, getTxPricing]);

  return {
    filtered,
    previous,
    isLoading,
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