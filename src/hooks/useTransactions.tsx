import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export type DateRange = "today" | "week" | "month" | "custom";

export interface Transaction {
  id: number;
  fecha: string;
  date: string | null;
  estacion: string | null;
  nombre_flota: string | null;
  nombre_cliente1: string | null;
  identificador_cliente1: string | null;
  ciudad: string | null;
  cantidad: number | null;
  cantidad_neta: number | null;
  producto: string | null;
  nombre_vendedor: string | null;
  placa: string | null;
  totalizador_bruto: number | null;
  factura: number | null;
  forma_de_pago: string | null;
  ppu: number | null;
  dinero_total: number | null;
  id_surtidor: number | null;
  surtidor: string | null;
  manguera: string | null;
}

function getDateRange(range: DateRange): { start: string; end: string } {
  const today = new Date();
  const endStr = format(today, "yyyy-MM-dd");
  let start: Date;

  switch (range) {
    case "today":
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      break;
    case "week":
      start = subDays(today, 7);
      break;
    case "month":
    default:
      start = subDays(today, 30);
      break;
  }

  return { start: format(start, "yyyy-MM-dd"), end: endStr };
}

function getPreviousRange(range: DateRange): { start: string; end: string } {
  const today = new Date();
  let days: number;
  switch (range) {
    case "today": days = 1; break;
    case "week": days = 7; break;
    case "month": default: days = 30; break;
  }
  const end = subDays(today, days);
  const start = subDays(today, days * 2);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

export function useTransactions(range: DateRange) {
  const { start, end } = getDateRange(range);

  return useQuery({
    queryKey: ["transactions", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("fecha", { ascending: false });

      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });
}

export function usePreviousTransactions(range: DateRange) {
  const { start, end } = getPreviousRange(range);

  return useQuery({
    queryKey: ["transactions-prev", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", start)
        .lte("date", end);

      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });
}

export function useAllTransactions() {
  return useQuery({
    queryKey: ["transactions-all"],
    queryFn: async () => {
      // Fetch all — may need pagination for very large datasets
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("fecha", { ascending: false });

      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });
}

export function useSyncLog() {
  return useQuery({
    queryKey: ["sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_log")
        .select("*")
        .order("synced_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    refetchInterval: 60000, // refresh every minute
  });
}
