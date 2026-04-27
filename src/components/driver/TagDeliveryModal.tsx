import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { usePlantItems } from "@/hooks/usePlantItems";
import { useProjects, useUpsertProject } from "@/hooks/useProjects";
import { useUpsertTransactionOverride } from "@/hooks/useTransactionOverrides";
import type { TransactionOverride } from "@/hooks/useTransactionOverrides";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transaction: any | null;
  clients: { id: number; company_name: string; speedsol_names?: string[] | null }[];
  currentOverride?: TransactionOverride;
}

const NONE = "__none__";
const NEW = "__new__";

export function TagDeliveryModal({
  open,
  onOpenChange,
  transaction,
  clients,
  currentOverride,
}: Props) {
  const [clientId, setClientId] = useState<number | null>(null);
  const [plantItemId, setPlantItemId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [creatingProject, setCreatingProject] = useState(false);

  const upsert = useUpsertTransactionOverride();
  const upsertProject = useUpsertProject();

  const { data: plantItems = [] } = usePlantItems(clientId);
  const { data: projects = [] } = useProjects(clientId);

  // Initialise from existing override / transaction context
  useEffect(() => {
    if (!open || !transaction) return;
    setClientId(transaction._clientAccountId ?? null);
    setPlantItemId(currentOverride?.plant_item_id || "");
    setProjectId(currentOverride?.project_id || "");
    setNewProjectName("");
  }, [open, transaction, currentOverride]);

  const sortedPlant = useMemo(
    () => [...plantItems].sort((a, b) => a.name.localeCompare(b.name)),
    [plantItems]
  );

  const handleSave = async () => {
    if (!transaction) return;
    let finalProjectId: string | null = projectId === NONE || !projectId ? null : projectId;

    // Create new project if requested
    if (projectId === NEW) {
      if (!clientId) {
        toast.error("Pick a client first to create a project.");
        return;
      }
      if (!newProjectName.trim()) {
        toast.error("Enter a name for the new project.");
        return;
      }
      setCreatingProject(true);
      try {
        const res = await upsertProject.mutateAsync({
          client_account_id: clientId,
          name: newProjectName.trim(),
        } as any);
        finalProjectId = (res as any)?.id || null;
      } catch (e: any) {
        toast.error(e.message || "Failed to create project");
        setCreatingProject(false);
        return;
      }
      setCreatingProject(false);
    }

    try {
      await upsert.mutateAsync({
        transaction_id: Number(transaction.id),
        plant_item_id: plantItemId === NONE || !plantItemId ? null : plantItemId,
        project_id: finalProjectId,
      });
      onOpenChange(false);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tag Delivery</DialogTitle>
        </DialogHeader>

        {transaction && (
          <div className="text-xs text-muted-foreground border border-border rounded-md p-3 mb-2">
            <div className="font-semibold text-foreground text-sm">
              {transaction.nombre_cliente1 || "Unknown"}
            </div>
            <div>
              {(transaction.cantidad || 0).toLocaleString()}L
              {transaction.placa ? ` · ${transaction.placa}` : ""}
              {transaction.factura ? ` · #${transaction.factura}` : ""}
            </div>
          </div>
        )}

        <div className="grid gap-3">
          <div>
            <Label>Client</Label>
            <Select
              value={clientId ? String(clientId) : ""}
              onValueChange={(v) => {
                setClientId(Number(v));
                setPlantItemId("");
                setProjectId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a client account" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Defaults from the delivery's site name when we recognise it.
            </p>
          </div>

          <div>
            <Label>Plant / Equipment</Label>
            <Select
              value={plantItemId || NONE}
              onValueChange={(v) => setPlantItemId(v === NONE ? "" : v)}
              disabled={!clientId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={clientId ? "Pick equipment" : "Pick a client first"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {sortedPlant.map((pi) => (
                  <SelectItem key={pi.id} value={pi.id}>
                    {pi.name}
                    {pi.placa ? ` · ${pi.placa}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Project</Label>
            <Select
              value={projectId || NONE}
              onValueChange={(v) => setProjectId(v === NONE ? "" : v)}
              disabled={!clientId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={clientId ? "Pick project" : "Pick a client first"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW}>＋ New project…</SelectItem>
              </SelectContent>
            </Select>

            {projectId === NEW && (
              <Input
                className="mt-2"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project name"
                autoFocus
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={upsert.isPending || creatingProject}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              upsert.isPending ||
              creatingProject ||
              !clientId ||
              (!plantItemId && !projectId)
            }
          >
            {upsert.isPending || creatingProject ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Save Tag
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}