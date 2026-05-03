import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, subDays, eachDayOfInterval } from "date-fns";
import { useDemo } from "./useDemo";
import { getDemoData, DEMO_RECON_ALERTS, DEMO_RECON_SETTINGS } from "@/data/demoData";

export interface PumpReading {
  id: string;
  reading_date: string;
  litres: number;
  driver_id: string;
  notes: string | null;
  created_at: string;
  truck: string;
}

export interface ReconAlert {
  id: string;
  alert_date: string;
  alert_type: string;
  values: Record<string, any>;
  status: string;
  suggested_action: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface ReconSettings {
  id: number;
  variance_threshold_pct: number;
  variance_threshold_litres: number;
  alert_sensitivity: string;
  calibration_factor: number;
  auto_weekly_report: boolean;
  report_email: string | null;
  updated_at: string;
}

export interface DailyReconRow {
  date: string;
  pumpLitres: number;
  speedsolLitres: number;
  varianceLitres: number;
  variancePct: number;
  alertStatus: "none" | "warning" | "critical";
  driverNotes: string[];
}

export function usePumpReadings(startDate: string, endDate: string) {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["pump-readings", startDate, endDate, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return getDemoData().pumpReadings.filter(
          (p: any) => p.reading_date >= startDate && p.reading_date <= endDate
        ) as PumpReading[];
      }
      const { data, error } = await supabase
        .from("pump_readings")
        .select("*")
        .gte("reading_date", startDate)
        .lte("reading_date", endDate)
        .order("reading_date", { ascending: false });
      if (error) throw error;
      return (data || []) as PumpReading[];
    },
  });
}

export function useDriverPumpReadings(days = 7) {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["driver-pump-readings", days, isDemo],
    queryFn: async () => {
      if (isDemo) {
        const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
        return getDemoData().pumpReadings.filter(
          (p: any) => p.reading_date >= startDate
        ) as PumpReading[];
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("pump_readings")
        .select("*")
        .eq("driver_id", user.id)
        .gte("reading_date", startDate)
        .order("reading_date", { ascending: false });
      if (error) throw error;
      return (data || []) as PumpReading[];
    },
  });
}

export function useSubmitPumpReading() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { litres: number; reading_date: string; notes?: string; truck?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from("pump_readings").insert({
        driver_id: user.id,
        litres: input.litres,
        reading_date: input.reading_date,
        notes: input.notes || null,
        truck: input.truck || "PACC Truck 1",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pump-readings"] });
      queryClient.invalidateQueries({ queryKey: ["driver-pump-readings"] });
    },
  });
}

export function useAdminInsertPumpReading() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { litres: number; reading_date: string; driver_id: string; notes?: string; truck?: string }) => {
      const { error } = await supabase.from("pump_readings").insert({
        driver_id: input.driver_id,
        litres: input.litres,
        reading_date: input.reading_date,
        notes: input.notes || null,
        truck: input.truck || "PACC Truck 1",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pump-readings"] });
      queryClient.invalidateQueries({ queryKey: ["driver-pump-readings"] });
    },
  });
}

export function useDeletePumpReading() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (readingId: string) => {
      const { error } = await supabase
        .from("pump_readings")
        .delete()
        .eq("id", readingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pump-readings"] });
      queryClient.invalidateQueries({ queryKey: ["driver-pump-readings"] });
    },
  });
}

export function useReconAlerts(startDate: string, endDate: string) {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["recon-alerts", startDate, endDate, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return DEMO_RECON_ALERTS.filter(
          (a) => a.alert_date >= startDate && a.alert_date <= endDate
        ) as ReconAlert[];
      }
      const { data, error } = await supabase
        .from("reconciliation_alerts")
        .select("*")
        .gte("alert_date", startDate)
        .lte("alert_date", endDate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ReconAlert[];
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("reconciliation_alerts")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user?.id } as any)
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recon-alerts"] });
    },
  });
}

export function useReconSettings() {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["recon-settings", isDemo],
    queryFn: async () => {
      if (isDemo) return DEMO_RECON_SETTINGS as ReconSettings;
      const { data, error } = await supabase
        .from("recon_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as ReconSettings;
    },
  });
}

export function useUpdateReconSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<ReconSettings>) => {
      const { error } = await supabase
        .from("recon_settings")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recon-settings"] });
    },
  });
}

export function getVarianceStatus(
  variancePct: number,
  varianceLitres: number,
  thresholdPct = 2,
  thresholdL = 50
): "none" | "warning" | "critical" {
  const absL = Math.abs(varianceLitres);
  const absPct = Math.abs(variancePct);
  if (absPct > 5 || absL > 150) return "critical";
  if (absPct > thresholdPct || absL > thresholdL) return "warning";
  return "none";
}

export function computeDailyRecon(
  pumpReadings: PumpReading[],
  transactions: any[],
  startDate: string,
  endDate: string,
  calibrationFactor = 0
): DailyReconRow[] {
  const days = eachDayOfInterval({
    start: new Date(startDate + "T00:00:00"),
    end: new Date(endDate + "T00:00:00"),
  });

  return days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayPumps = pumpReadings.filter((p) => p.reading_date === dateStr);
    const dayTxns = transactions.filter((t) => t.date === dateStr);

    const rawPumpL = dayPumps.reduce((s, p) => s + Number(p.litres), 0);
    const pumpL = rawPumpL * (1 + calibrationFactor / 100);
    const speedsolL = dayTxns.reduce((s, t) => s + (t.cantidad || 0), 0);
    const varianceL = pumpL - speedsolL;
    const variancePct = pumpL > 0 ? (varianceL / pumpL) * 100 : 0;

    return {
      date: dateStr,
      pumpLitres: Math.round(pumpL * 100) / 100,
      speedsolLitres: Math.round(speedsolL * 100) / 100,
      varianceLitres: Math.round(varianceL * 100) / 100,
      variancePct: Math.round(variancePct * 100) / 100,
      alertStatus: getVarianceStatus(variancePct, varianceL),
      driverNotes: dayPumps.filter((p) => p.notes).map((p) => p.notes!),
    };
  }).reverse();
}
