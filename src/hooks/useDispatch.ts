import { useState, useCallback, useRef, useEffect } from "react";
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

export function useLocations(date?: string) {
  return useQuery({
    queryKey: ["dispatch-locations", date],
    queryFn: () => dispatch("get_locations", { date }),
    staleTime: 300000,
  });
}

/**
 * Polls OptimoRoute planning status until finished, then refreshes the schedule.
 * Returns { isPlanning, planningProgress, startPolling }.
 */
export function usePlanningStatus() {
  const qc = useQueryClient();
  const [isPlanning, setIsPlanning] = useState(false);
  const [planningProgress, setPlanningProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (planningId: number) => {
      stopPolling();
      setIsPlanning(true);
      setPlanningProgress(0);

      // Poll every 1.5s
      intervalRef.current = setInterval(async () => {
        try {
          const result = await dispatch("get_planning_status", { planningId });
          const pct = result?.percentageComplete ?? 0;
          const status = result?.status; // N=New, R=Running, F=Finished, C=Cancelled, E=Error

          setPlanningProgress(pct);

          if (status === "F" || status === "C" || status === "E" || pct >= 100) {
            stopPolling();
            setIsPlanning(false);
            setPlanningProgress(100);

            // Refresh schedule after planning completes
            await qc.invalidateQueries({ queryKey: ["dispatch-schedule"] });
            await qc.invalidateQueries({ queryKey: ["dispatch-locations"] });
          }
        } catch {
          // On error, stop polling and refresh anyway
          stopPolling();
          setIsPlanning(false);
          qc.invalidateQueries({ queryKey: ["dispatch-schedule"] });
        }
      }, 1500);

      // Safety timeout: stop after 60s regardless
      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setIsPlanning(false);
        qc.invalidateQueries({ queryKey: ["dispatch-schedule"] });
      }, 60000);
    },
    [qc, stopPolling]
  );

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  return { isPlanning, planningProgress, startPolling };
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: Record<string, unknown>) =>
      dispatch("create_order", { order }),
    onSuccess: async (data) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dispatch-schedule"] }),
        qc.invalidateQueries({ queryKey: ["dispatch-locations"] }),
      ]);

      // Return planningId so the caller can start polling
      return data;
    },
  });
}

export function useOptimise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) => dispatch("optimise", { date }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dispatch-schedule"] });
    },
  });
}

export function useReorderStops() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orders: Record<string, unknown>[]) =>
      dispatch("reorder_stops", { orders }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispatch-schedule"] });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderNos, ids }: { orderNos: string[]; ids?: string[] }) =>
      dispatch("delete_order", { orderNos, ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-schedule"] }),
  });
}
