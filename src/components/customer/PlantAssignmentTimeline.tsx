import { useMemo } from "react";
import { format } from "date-fns";
import { ArrowRight, Clock } from "lucide-react";
import { usePlantAssignmentAudit, useProjects } from "@/hooks/useProjects";

interface Props {
  plantItemId: string;
  clientAccountId: number;
}

/**
 * Shows the chronological history of project assignments for a plant item.
 * Each entry corresponds to a drag-and-drop move (or unassign) and records
 * the from-project, to-project, who did it, and when.
 */
export function PlantAssignmentTimeline({ plantItemId, clientAccountId }: Props) {
  const { data: audit = [], isLoading } = usePlantAssignmentAudit(plantItemId);
  const { data: projects = [] } = useProjects(clientAccountId);

  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.id, p.name));
    return (id: string | null) => (id ? m.get(id) ?? "Unknown project" : "Unassigned");
  }, [projects]);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading history…</p>;
  }

  if (!audit.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No project moves recorded yet. Drag this item between projects on the Projects tab to start tracking history.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-border pl-4 space-y-3">
      {audit.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border border-background" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {format(new Date(entry.changed_at), "d MMM yyyy, h:mm a")}
          </div>
          <div className="flex items-center gap-2 text-sm mt-0.5">
            <span className="text-muted-foreground">{projectName(entry.from_project_id)}</span>
            <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium">{projectName(entry.to_project_id)}</span>
          </div>
          {entry.source !== "drag_and_drop" && (
            <p className="text-[10px] text-muted-foreground mt-0.5">via {entry.source}</p>
          )}
        </li>
      ))}
    </ol>
  );
}