import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Project {
  id: string;
  client_account_id: number;
  name: string;
  site_address: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  plant_item_id: string;
  assigned_at: string;
  removed_at: string | null;
}

export function useProjects(clientAccountId: number | null | undefined) {
  return useQuery({
    queryKey: ["projects", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("client_account_id", clientAccountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Project[];
    },
  });
}

export function useProjectAssignments(clientAccountId: number | null | undefined) {
  return useQuery({
    queryKey: ["project-assignments", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () => {
      // Pull all assignments for projects of this client
      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("id")
        .eq("client_account_id", clientAccountId!);
      if (pErr) throw pErr;
      const projectIds = (projects || []).map((p) => p.id);
      if (!projectIds.length) return [] as ProjectAssignment[];
      const { data, error } = await supabase
        .from("project_plant_assignments")
        .select("*")
        .in("project_id", projectIds);
      if (error) throw error;
      return (data || []) as ProjectAssignment[];
    },
  });
}

export function useUpsertProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<Project> & { client_account_id: number; name: string }) => {
      if (p.id) {
        const { error } = await supabase.from("projects").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects", vars.client_account_id] });
      toast({ title: "Project saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; client_account_id: number }) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects", vars.client_account_id] });
      qc.invalidateQueries({ queryKey: ["project-assignments", vars.client_account_id] });
      toast({ title: "Project deleted" });
    },
  });
}

export function useToggleAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      project_id,
      plant_item_id,
      assign,
    }: {
      project_id: string;
      plant_item_id: string;
      assign: boolean;
      client_account_id: number;
    }) => {
      if (assign) {
        const { error } = await supabase
          .from("project_plant_assignments")
          .insert({ project_id, plant_item_id });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("project_plant_assignments")
          .delete()
          .eq("project_id", project_id)
          .eq("plant_item_id", plant_item_id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["project-assignments", vars.client_account_id] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
}

/**
 * Moves a plant item from any current project(s) to a single target project.
 * Pass target_project_id = null to unassign (remove all assignments for this item).
 */
export function useMoveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      plant_item_id,
      target_project_id,
    }: {
      plant_item_id: string;
      target_project_id: string | null;
      client_account_id: number;
    }) => {
      // Remove existing assignments for this plant item
      const { error: delErr } = await supabase
        .from("project_plant_assignments")
        .delete()
        .eq("plant_item_id", plant_item_id);
      if (delErr) throw delErr;

      if (target_project_id) {
        const { error: insErr } = await supabase
          .from("project_plant_assignments")
          .insert({ plant_item_id, project_id: target_project_id });
        if (insErr && !insErr.message.includes("duplicate")) throw insErr;
      }
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["project-assignments", vars.client_account_id] });
      const prev = qc.getQueryData<any[]>(["project-assignments", vars.client_account_id]);
      if (prev) {
        const next = prev.filter((a) => a.plant_item_id !== vars.plant_item_id);
        if (vars.target_project_id) {
          next.push({
            id: `temp-${Date.now()}`,
            project_id: vars.target_project_id,
            plant_item_id: vars.plant_item_id,
            assigned_at: new Date().toISOString(),
            removed_at: null,
          });
        }
        qc.setQueryData(["project-assignments", vars.client_account_id], next);
      }
      return { prev };
    },
    onError: (e: any, vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["project-assignments", vars.client_account_id], ctx.prev);
      }
      toast({ title: "Move failed", description: e.message, variant: "destructive" });
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["project-assignments", vars.client_account_id] });
    },
  });
}