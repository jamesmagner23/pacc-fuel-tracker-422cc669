import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { DEMO_PROJECTS, DEMO_PROJECT_ASSIGNMENTS } from "@/data/demoData";

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
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["projects", clientAccountId, isDemo],
    enabled: !!clientAccountId,
    queryFn: async () => {
      if (isDemo) {
        return DEMO_PROJECTS.filter((p) => p.client_account_id === clientAccountId) as Project[];
      }
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
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["project-assignments", clientAccountId, isDemo],
    enabled: !!clientAccountId,
    queryFn: async () => {
      if (isDemo) {
        const projectIds = new Set(
          DEMO_PROJECTS.filter((p) => p.client_account_id === clientAccountId).map((p) => p.id)
        );
        return DEMO_PROJECT_ASSIGNMENTS.filter((a) => projectIds.has(a.project_id)) as ProjectAssignment[];
      }
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
        return { id: p.id };
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert(p)
          .select("id")
          .single();
        if (error) throw error;
        return { id: (data as any)?.id as string };
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
      const now = new Date().toISOString();

      // Capture current open assignment (if any) BEFORE we close it,
      // so we can write an accurate audit entry with the from-project.
      const { data: openRows } = await supabase
        .from("project_plant_assignments")
        .select("project_id")
        .eq("plant_item_id", plant_item_id)
        .is("removed_at", null);
      const fromProjectId = openRows?.[0]?.project_id ?? null;

      // Soft-close any currently open assignment(s) so historical attribution
      // is preserved. Each transaction will be attributed to the project that
      // was active at that delivery's date.
      const { error: closeErr } = await supabase
        .from("project_plant_assignments")
        .update({ removed_at: now })
        .eq("plant_item_id", plant_item_id)
        .is("removed_at", null);
      if (closeErr) throw closeErr;

      // Open a new assignment on the target project starting now.
      if (target_project_id) {
        const { error: insErr } = await supabase
          .from("project_plant_assignments")
          .insert({
            plant_item_id,
            project_id: target_project_id,
            assigned_at: now,
            removed_at: null,
          });
        if (insErr) throw insErr;
      }

      // Audit the move (best-effort: don't fail the user action if audit insert fails).
      if (fromProjectId !== target_project_id) {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("plant_assignment_audit").insert({
          plant_item_id,
          from_project_id: fromProjectId,
          to_project_id: target_project_id,
          changed_by: userData?.user?.id ?? null,
          changed_at: now,
          source: "drag_and_drop",
        });
      }
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["project-assignments", vars.client_account_id] });
      const prev = qc.getQueryData<any[]>(["project-assignments", vars.client_account_id]);
      if (prev) {
        const now = new Date().toISOString();
        // Soft-close existing open rows for this plant item; keep history rows intact.
        const next = prev.map((a) =>
          a.plant_item_id === vars.plant_item_id && !a.removed_at
            ? { ...a, removed_at: now }
            : a
        );
        if (vars.target_project_id) {
          next.push({
            id: `temp-${Date.now()}`,
            project_id: vars.target_project_id,
            plant_item_id: vars.plant_item_id,
            assigned_at: now,
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
      qc.invalidateQueries({ queryKey: ["plant-assignment-audit", vars.plant_item_id] });
    },
  });
}

export interface PlantAssignmentAuditEntry {
  id: string;
  plant_item_id: string;
  from_project_id: string | null;
  to_project_id: string | null;
  changed_by: string | null;
  changed_at: string;
  source: string;
  notes: string | null;
}

export function usePlantAssignmentAudit(plant_item_id: string | null | undefined) {
  return useQuery({
    queryKey: ["plant-assignment-audit", plant_item_id],
    enabled: !!plant_item_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_assignment_audit")
        .select("*")
        .eq("plant_item_id", plant_item_id!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PlantAssignmentAuditEntry[];
    },
  });
}