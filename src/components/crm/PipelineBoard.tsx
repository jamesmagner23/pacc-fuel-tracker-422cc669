import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CrmCustomer } from "@/hooks/useCrm";

type StageDef = { id: string; label: string };
type Mode = "acquisition" | "retention";

type Props = {
  mode: Mode;
  customers: CrmCustomer[];
  onSelect: (c: CrmCustomer) => void;
  onChanged: () => void;
};

const ACQ_STAGES: StageDef[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "quoted", label: "Quoted" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];
const RET_STAGES: StageDef[] = [
  { id: "active", label: "Active" },
  { id: "at_risk", label: "At-risk" },
  { id: "churned", label: "Churned" },
];

export default function PipelineBoard({ mode, customers, onSelect, onChanged }: Props) {
  const stages = mode === "acquisition" ? ACQ_STAGES : RET_STAGES;
  const field = mode === "acquisition" ? "acquisition_stage" : "retention_stage";

  const filtered = useMemo(() => customers.filter(c =>
    mode === "acquisition" ? c.kind === "prospect" || c.kind === "client" : c.kind === "client"
  ), [customers, mode]);

  const grouped = useMemo(() => {
    const m: Record<string, CrmCustomer[]> = {};
    for (const s of stages) m[s.id] = [];
    for (const c of filtered) {
      const stage = (c as any)[field] as string;
      if (m[stage]) m[stage].push(c);
    }
    return m;
  }, [filtered, stages, field]);

  async function moveTo(id: string, stage: string) {
    const { error } = await supabase.from("crm_customers").update({ [field]: stage }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))`, overflowX: "auto" }}>
      {stages.map(s => (
        <div
          key={s.id}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("text/customer-id");
            if (id) void moveTo(id, s.id);
          }}
          className="bg-surface border border-surface-border rounded-lg p-3 min-h-[60vh]"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</h3>
            <span className="text-xs text-muted-foreground">{grouped[s.id].length}</span>
          </div>
          <div className="space-y-2">
            {grouped[s.id].map(c => (
              <button
                key={c.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/customer-id", c.id)}
                onClick={() => onSelect(c)}
                className="w-full text-left bg-surface-raised border border-surface-border rounded p-3 hover:border-accent transition-colors"
              >
                <div className="font-medium text-sm text-foreground truncate">{c.name}</div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                  {c.source && <span>{c.source}</span>}
                  {c.estimated_value != null && <span>${Number(c.estimated_value).toLocaleString()}</span>}
                </div>
                {c.next_follow_up_at && (
                  <div className="text-[11px] text-accent mt-1">↻ {c.next_follow_up_at}</div>
                )}
              </button>
            ))}
            {grouped[s.id].length === 0 && (
              <div className="text-[11px] text-muted-foreground text-center py-6 border border-dashed border-surface-border rounded">
                Drop here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}