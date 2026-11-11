import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "./useDemo";
import { getDemoData } from "@/data/demoData";
import type { Transaction } from "./useTransactions";
import { withTimeout } from "@/lib/requestTimeout";

export const TRANSACTION_PAGE_SIZE = 50;
export interface TransactionPageFilters { start: string; end: string; search: string; customer: string; truck: string; driver: string; sort: string; ascending: boolean }
export async function fetchTransactionPage(filters: TransactionPageFilters, page: number, signal?: AbortSignal) {
  let query = supabase.from("transactions").select("id,fecha,date,estacion,nombre_flota,nombre_cliente1,identificador_cliente1,ciudad,cantidad,cantidad_neta,producto,nombre_vendedor,placa,totalizador_bruto,factura,forma_de_pago,ppu,dinero_total,id_surtidor,surtidor,manguera", { count: "exact" })
    .gte("date", filters.start).lte("date", filters.end);
  if (filters.customer) query = query.eq("nombre_cliente1", filters.customer);
  if (filters.truck) query = query.eq("estacion", filters.truck);
  if (filters.driver) query = query.eq("nombre_vendedor", filters.driver);
  // Escape filter delimiters and wildcard characters, search the whole range on the server.
  const term = filters.search.replace(/[,%()*\\]/g, " ").trim();
  if (term) query = query.ilike("nombre_cliente1", `%${term}%`);
  query = query.order(filters.sort, { ascending: filters.ascending, nullsFirst: false }).order("id", { ascending: filters.ascending })
    .range(page * TRANSACTION_PAGE_SIZE, (page + 1) * TRANSACTION_PAGE_SIZE - 1);
  if (signal) query = query.abortSignal(signal);
  const { data, count, error } = await withTimeout(query);
  if (error) throw error;
  return { rows: (data ?? []) as Transaction[], count: count ?? 0 };
}
export function useTransactionPage(filters: TransactionPageFilters, page: number) {
  const demo = useDemo();
  return useQuery({ queryKey: ["transaction-page", filters, page, demo], enabled: Boolean(filters.start && filters.end && filters.start <= filters.end), retry: 1,
    queryFn: ({ signal }) => {
      if (!demo) return fetchTransactionPage(filters, page, signal);
      const rows = getDemoData().transactions.filter(t => t.date && t.date >= filters.start && t.date <= filters.end && (!filters.customer || t.nombre_cliente1 === filters.customer) && (!filters.truck || t.estacion === filters.truck) && (!filters.driver || t.nombre_vendedor === filters.driver) && (!filters.search || (t.nombre_cliente1 ?? "").toLowerCase().includes(filters.search.toLowerCase())))
        .sort((a, b) => String(a[filters.sort as keyof Transaction] ?? "").localeCompare(String(b[filters.sort as keyof Transaction] ?? "")) * (filters.ascending ? 1 : -1));
      return { rows: rows.slice(page * TRANSACTION_PAGE_SIZE, (page + 1) * TRANSACTION_PAGE_SIZE), count: rows.length };
    },
  });
}