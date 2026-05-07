import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DispatchStop {
  id: string;
  scheduled_date: string;
  client_account_id: number;
  project_id: string | null;
  truck_id: string | null;
  driver_user_id: string | null;
  site_name: string;
  address: string | null;
  estimated_litres: number | null;
  delivered_litres: number | null;
  sequence: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  recurring_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchRecurring {
  id: string;
  client_account_id: number;
  project_id: string | null;
  truck_id: string | null;
  site_name: string;
  address: string | null;
  estimated_litres: number | null;
  notes: string | null;
  frequency: "daily" | "weekly" | "weekdays";
  weekdays: number[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

export function useDispatchStops(date?: string, truckId?: string | null) {
  return useQuery({
    queryKey: ["dispatch-stops", date, truckId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("dispatch_stops" as any)
        .select("*")
        .order("sequence", { ascending: true });
      if (date) q = q.eq("scheduled_date", date);
      if (truckId) q = q.eq("truck_id", truckId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as DispatchStop[];
    },
    refetchInterval: 30000,
  });
}

export function useUpsertStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<DispatchStop> & { scheduled_date: string; client_account_id: number; site_name: string }) => {
      const payload: any = { ...s };
      const { data, error } = await supabase
        .from("dispatch_stops" as any)
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DispatchStop;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-stops"] }),
  });
}

export function useDeleteStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dispatch_stops" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-stops"] }),
  });
}

export function useReorderDispatchStops() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orders: { id: string; sequence: number }[]) => {
      // bulk update sequences
      await Promise.all(
        orders.map((o) =>
          supabase
            .from("dispatch_stops" as any)
            .update({ sequence: o.sequence })
            .eq("id", o.id)
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-stops"] }),
  });
}

export function useUpdateStopStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, delivered_litres }: { id: string; status: DispatchStop["status"]; delivered_litres?: number }) => {
      const patch: any = { status };
      if (status === "completed") patch.completed_at = new Date().toISOString();
      if (delivered_litres !== undefined) patch.delivered_litres = delivered_litres;
      const { error } = await supabase.from("dispatch_stops" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-stops"] }),
  });
}

export function useUpsertRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Partial<DispatchRecurring> & { client_account_id: number; site_name: string; frequency: DispatchRecurring["frequency"] }) => {
      const { data, error } = await supabase
        .from("dispatch_recurring" as any)
        .upsert(r as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DispatchRecurring;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-recurring"] }),
  });
}

export function useRecurring() {
  return useQuery({
    queryKey: ["dispatch-recurring"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_recurring" as any)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DispatchRecurring[];
    },
  });
}
