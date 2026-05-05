import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Truck {
  id: string;
  name: string;
  rego: string | null;
  speedsol_estacion: string | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  serial_number: string | null;
  tank_capacity_litres: number | null;
  build_date: string | null;
  current_km: number | null;
  last_service_km: number | null;
  last_service_date: string | null;
  next_service_km: number | null;
  next_service_date: string | null;
  is_active: boolean;
  photo_path: string | null;
  notes: string | null;
}

export interface TruckDocument {
  id: string;
  truck_id: string;
  doc_type: string;
  label: string | null;
  file_path: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface TruckServiceRecord {
  id: string;
  truck_id: string;
  service_date: string;
  service_km: number | null;
  service_type: string | null;
  vendor: string | null;
  cost: number | null;
  file_path: string | null;
  notes: string | null;
}

export function useTrucks() {
  return useQuery({
    queryKey: ["trucks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trucks" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Truck[];
    },
  });
}

export function useUpsertTruck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<Truck> & { id?: string }) => {
      const payload: any = { ...t, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("trucks" as any)
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Truck;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trucks"] }),
  });
}

export function useTruckDocuments(truckId: string | null) {
  return useQuery({
    queryKey: ["truck-docs", truckId],
    enabled: !!truckId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("truck_documents" as any)
        .select("*")
        .eq("truck_id", truckId!)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as TruckDocument[];
    },
  });
}

export function useUpsertTruckDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: Partial<TruckDocument> & { truck_id: string; doc_type: string }) => {
      const { data, error } = await supabase
        .from("truck_documents" as any)
        .upsert(d as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TruckDocument;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["truck-docs", vars.truck_id] }),
  });
}

export function useDeleteTruckDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, truck_id }: { id: string; truck_id: string }) => {
      const { error } = await supabase.from("truck_documents" as any).delete().eq("id", id);
      if (error) throw error;
      return { id, truck_id };
    },
    onSuccess: ({ truck_id }) => qc.invalidateQueries({ queryKey: ["truck-docs", truck_id] }),
  });
}

export function useTruckServiceRecords(truckId: string | null) {
  return useQuery({
    queryKey: ["truck-service", truckId],
    enabled: !!truckId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("truck_service_records" as any)
        .select("*")
        .eq("truck_id", truckId!)
        .order("service_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TruckServiceRecord[];
    },
  });
}

export function useUpsertTruckServiceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Partial<TruckServiceRecord> & { truck_id: string; service_date: string }) => {
      const { data, error } = await supabase
        .from("truck_service_records" as any)
        .upsert(r as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TruckServiceRecord;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["truck-service", vars.truck_id] }),
  });
}

export function useDeleteTruckServiceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, truck_id }: { id: string; truck_id: string }) => {
      const { error } = await supabase.from("truck_service_records" as any).delete().eq("id", id);
      if (error) throw error;
      return { id, truck_id };
    },
    onSuccess: ({ truck_id }) => qc.invalidateQueries({ queryKey: ["truck-service", truck_id] }),
  });
}

/** Generate a signed URL (1 hour) for a file in the truck-docs bucket. */
export async function getTruckDocSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("truck-docs")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function uploadTruckDoc(truckId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${truckId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("truck-docs")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}