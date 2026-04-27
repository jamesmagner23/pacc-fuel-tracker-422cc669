import { useMemo, useState } from "react";
import { Truck, FolderKanban, Package, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMoveAssignment, type Project } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";

interface EquipmentEntry {
  placa: string | null;
  litres: number;
  deliveries: number;
  enriched?: {
    id: string;
    name: string;
    equipment_type?: string | null;
    photo_url?: string | null;
  } | null;
}

interface Assignment {
  project_id: string;
  plant_item_id: string;
}

interface PlantBoardProps {
  projects: Project[];
  equipment: EquipmentEntry[];
  assignments: Assignment[];
  clientAccountId: number;
  readOnly?: boolean;
}

/**
 * Drag-and-drop board: columns = "Unassigned" + each project,
 * cards = enriched plant items. Drop into a column to (re)assign.
 * Touch-friendly fallback: tap a card, then tap a column.
 */
export function PlantBoard({
  projects,
  equipment,
  assignments,
  clientAccountId,
  readOnly = false,
}: PlantBoardProps) {
  const move = useMoveAssignment();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // tap-to-move fallback for touch devices
  const [picked, setPicked] = useState<string | null>(null);

  // Only enriched plant items can be assigned
  const enrichedItems = useMemo(
    () => equipment.filter((e) => e.enriched),
    [equipment]
  );

  // index assignments by plant item id → project id (single active project per plant)
  const projectByItem = useMemo(() => {
    const m: Record<string, string> = {};
    assignments.forEach((a) => {
      m[a.plant_item_id] = a.project_id;
    });
    return m;
  }, [assignments]);

  const itemsByColumn = useMemo(() => {
    const cols: Record<string, EquipmentEntry[]> = { __unassigned__: [] };
    projects.forEach((p) => {
      cols[p.id] = [];
    });
    enrichedItems.forEach((e) => {
      const pid = projectByItem[e.enriched!.id];
      const key = pid && cols[pid] ? pid : "__unassigned__";
      cols[key].push(e);
    });
    // sort each column by litres desc
    Object.values(cols).forEach((arr) =>
      arr.sort((a, b) => b.litres - a.litres)
    );
    return cols;
  }, [enrichedItems, projects, projectByItem]);

  const handleDrop = (targetProjectId: string | null, plantItemId: string) => {
    const current = projectByItem[plantItemId] || null;
    if (current === targetProjectId) return;
    move.mutate({
      plant_item_id: plantItemId,
      target_project_id: targetProjectId,
      client_account_id: clientAccountId,
    });
  };

  const handleColumnTap = (targetProjectId: string | null) => {
    if (!picked) return;
    handleDrop(targetProjectId, picked);
    setPicked(null);
  };

  if (enrichedItems.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
        No enriched equipment yet. Add plant items in the Equipment tab to start
        assigning them to projects.
      </div>
    );
  }

  const columns: { id: string | null; key: string; title: string; subtitle?: string; isUnassigned?: boolean }[] = [
    { id: null, key: "__unassigned__", title: "Unassigned", subtitle: "Available plant", isUnassigned: true },
    ...projects.map((p) => ({
      id: p.id,
      key: p.id,
      title: p.name,
      subtitle: p.site_address || undefined,
    })),
  ];

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>Drag a plant card into a project column to reassign.</span>
          {picked && (
            <span className="text-primary font-medium">
              Tap a column to move the selected plant.
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {columns.map((col) => {
          const items = itemsByColumn[col.key] || [];
          const totalLitres = items.reduce((s, e) => s + e.litres, 0);
          const isOver = over === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (readOnly) return;
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                if (readOnly) return;
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) handleDrop(col.id, id);
                setOver(null);
                setDragging(null);
              }}
              onClick={() => picked && handleColumnTap(col.id)}
              className={cn(
                "flex flex-col rounded-lg border transition-all min-h-[160px]",
                col.isUnassigned
                  ? "border-dashed border-border bg-card/20"
                  : "border-border bg-card/40",
                isOver && "border-primary/60 bg-primary/5",
                picked && !readOnly && "cursor-pointer hover:border-primary/50"
              )}
            >
              <div className="px-3 py-2 border-b border-border/60 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {col.isUnassigned ? (
                      <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                    <span className="text-xs font-semibold truncate">{col.title}</span>
                  </div>
                  {col.subtitle && (
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {col.subtitle}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {items.length}
                </Badge>
              </div>

              <div className="p-2 flex-1 space-y-1.5 min-h-[80px]">
                {items.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground italic text-center py-4">
                    {col.isUnassigned
                      ? "All plant assigned"
                      : readOnly
                      ? "No plant assigned"
                      : "Drop plant here"}
                  </div>
                ) : (
                  items.map((e) => {
                    const id = e.enriched!.id;
                    const isPicked = picked === id;
                    const isDragging = dragging === id;
                    return (
                      <div
                        key={id}
                        draggable={!readOnly}
                        onDragStart={(ev) => {
                          if (readOnly) return;
                          ev.dataTransfer.setData("text/plain", id);
                          ev.dataTransfer.effectAllowed = "move";
                          setDragging(id);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        onClick={(ev) => {
                          if (readOnly) return;
                          ev.stopPropagation();
                          setPicked((p) => (p === id ? null : id));
                        }}
                        className={cn(
                          "rounded-md border bg-background/60 p-2 select-none transition-all",
                          !readOnly && "cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-background",
                          isDragging && "opacity-40",
                          isPicked && "ring-2 ring-primary border-primary/60"
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          {!readOnly && (
                            <GripVertical className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <Truck className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate leading-tight">
                              {e.enriched!.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {e.placa}
                              {e.enriched!.equipment_type && (
                                <> · {e.enriched!.equipment_type}</>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                              {e.litres.toLocaleString()}L · {e.deliveries} fills
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {items.length > 0 && (
                <div className="px-3 py-1.5 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>Total fuel</span>
                  <span className="font-semibold text-foreground">
                    {totalLitres.toLocaleString()}L
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}