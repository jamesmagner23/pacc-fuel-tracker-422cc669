import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function dispatch(action: string, payload?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("dispatch", {
    body: { action, payload },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? "Dispatch failed");
  return data.data;
}

export function useSchedule(date?: string) {
  return useQuery({
    queryKey: ["dispatch-schedule", date],
    queryFn: () => dispatch("get_schedule", { date }),
    refetchInterval: 60000,
    staleTime: 55000,
  });
}

export function useCompletions(date?: string) {
  return useQuery({
    queryKey: ["dispatch-completions", date],
    queryFn: () => dispatch("get_completions", { date }),
    staleTime: 55000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: Record<string, unknown>) =>
      dispatch("create_order", { order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-schedule"] }),
  });
}

export function useOptimise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) => dispatch("optimise", { date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-schedule"] }),
  });
}

export function useReorderStops() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orders: Record<string, unknown>[]) =>
      dispatch("reorder_stops", { orders }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-schedule"] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderNos: string[]) =>
      dispatch("delete_order", { orderNos }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-schedule"] }),
  });
}
