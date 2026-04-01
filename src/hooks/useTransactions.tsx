import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";
import { useDemo } from "./useDemo";
import { getDemoData, DEMO_SYNC_LOG } from "@/data/demoData";

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
    case "week": {
      const day = today.getDay(); // 0=Sun,1=Mon,...
      const diffToMonday = day === 0 ? 6 : day - 1;
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday);
      break;
    }
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
    case "week": {
      const day = today.getDay();
      days = day === 0 ? 6 : day - 1;
      if (days === 0) days = 7;
      break;
    }
    case "month": default: days = 30; break;
  }
  const end = subDays(today, days);
  const start = subDays(today, days * 2);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

function filterByDateRange(txns: Transaction[], start: string, end: string) {
  return txns.filter(t => t.date && t.date >= start && t.date <= end);
}

export function useTransactions(range: DateRange) {
  const isDemo = useDemo();
  const { start, end } = getDateRange(range);

  return useQuery({
    queryKey: ["transactions", start, end, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return filterByDateRange(getDemoData().transactions, start, end);
      }
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
  const isDemo = useDemo();
  const { start, end } = getPreviousRange(range);

  return useQuery({
    queryKey: ["transactions-prev", start, end, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return filterByDateRange(getDemoData().transactions, start, end);
      }
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
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["transactions-all", isDemo],
    queryFn: async () => {
      if (isDemo) return getDemoData().transactions;
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
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["sync-log", isDemo],
    queryFn: async () => {
      if (isDemo) return DEMO_SYNC_LOG;
      const { data, error } = await supabase
        .from("sync_log")
        .select("*")
        .order("synced_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    refetchInterval: isDemo ? false : 60000,
  });
}
