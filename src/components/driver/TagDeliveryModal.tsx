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
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { usePlantItems } from "@/hooks/usePlantItems";
import { useProjects, useUpsertProject } from "@/hooks/useProjects";
import { useUpsertTransactionOverride } from "@/hooks/useTransactionOverrides";
import type { TransactionOverride } from "@/hooks/useTransactionOverrides";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const [newProjectSite, setNewProjectSite] = useState<string>("");
  const [newProjectCode, setNewProjectCode] = useState<string>("");
  const [newProjectStart, setNewProjectStart] = useState<string>("");
  const [newProjectEnd, setNewProjectEnd] = useState<string>("");
  const [creatingProject, setCreatingProject] = useState(false);

  // Confirmation step: once a preview is loaded we show the summary and
  // require an explicit "Confirm & Apply" before writing the override.
  const [preview, setPreview] = useState<{
    plant_item_name: string | null;
    placa: string | null;
    conflict: boolean;
    conflict_count: number;
    conflict_names: string[];
    backfill_count: number;
    plant_label: string;
    project_label: string;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // When the preview reports siblings will be backfilled, the user picks
  // whether to tag just this delivery or all matching ones.
  const [scope, setScope] = useState<"single" | "all">("all");

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
    setNewProjectSite("");
    setNewProjectCode("");
    setNewProjectStart("");
    setNewProjectEnd("");
    setPreview(null);
    setScope("all");
  }, [open, transaction, currentOverride]);

  const sortedPlant = useMemo(
    () => [...plantItems].sort((a, b) => a.name.localeCompare(b.name)),
    [plantItems]
  );

  // Duplicate detection: case-insensitive trimmed match against this client's projects
  const duplicateProject = useMemo(() => {
    const q = newProjectName.trim().toLowerCase();
    if (!q || projectId !== NEW) return null;
    return projects.find((p) => (p.name || "").trim().toLowerCase() === q) || null;
  }, [newProjectName, projects, projectId]);

  // Build the in-memory project label for the preview summary.
  const selectedProjectLabel = useMemo(() => {
    if (!projectId || projectId === NONE) return "— None —";
    if (projectId === NEW) return newProjectName.trim() || "(new project)";
    return projects.find((p) => p.id === projectId)?.name || "(project)";
  }, [projectId, newProjectName, projects]);

  const selectedPlantLabel = useMemo(() => {
    if (!plantItemId || plantItemId === NONE) return "— None —";
    const pi = sortedPlant.find((p) => p.id === plantItemId);
    return pi ? `${pi.name}${pi.placa ? ` · ${pi.placa}` : ""}` : "(plant)";
  }, [plantItemId, sortedPlant]);

  /** Step 1: validate inputs, fetch the preview, and show the confirm summary. */
  const handleReview = async () => {
    if (!transaction) return;

    if (projectId === NEW) {
      if (!clientId) {
        toast.error("Pick a client first to create a project.");
        return;
      }
      if (!newProjectName.trim()) {
        toast.error("Enter a name for the new project.");
        return;
      }
      if (duplicateProject) {
        toast.error("A project with this name already exists. Use it instead.");
        return;
      }
      if (newProjectStart && newProjectEnd && newProjectEnd < newProjectStart) {
        toast.error("End date can't be before start date.");
        return;
      }
    }

    setPreviewing(true);
    try {
      const pid = plantItemId && plantItemId !== NONE ? plantItemId : null;
      const { data, error } = await supabase.rpc("preview_tag_transaction", {
        _transaction_id: Number(transaction.id),
        _plant_item_id: pid,
      });
      if (error) throw error;
      const r = (data || {}) as any;
      setPreview({
        plant_item_name: r.plant_item_name ?? null,
        placa: r.placa ?? null,
        conflict: Boolean(r.conflict),
        conflict_count: Number(r.conflict_count ?? 0),
        conflict_names: Array.isArray(r.conflict_names) ? r.conflict_names : [],
        backfill_count: Number(r.backfill_count ?? 0),
        plant_label: selectedPlantLabel,
        project_label: selectedProjectLabel,
      });
    } catch (e: any) {
      toast.error(e.message || "Couldn't load preview");
    } finally {
      setPreviewing(false);
    }
  };

  /** Step 2: user confirmed — create the project (if new) and write the override. */
  const handleConfirm = async () => {
    if (!transaction) return;
    let finalProjectId: string | null = projectId === NONE || !projectId ? null : projectId;

    if (projectId === NEW) {
      setCreatingProject(true);
      try {
        const res = await upsertProject.mutateAsync({
          client_account_id: clientId,
          name: newProjectName.trim(),
          site_address: newProjectSite.trim() || null,
          notes: newProjectCode.trim() ? `Job code: ${newProjectCode.trim()}` : null,
          start_date: newProjectStart || null,
          end_date: newProjectEnd || null,
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
        single: scope === "single",
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
          <DialogTitle>{preview ? "Confirm Tag" : "Tag Delivery"}</DialogTitle>
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

        {preview ? (
          <div className="grid gap-3 text-sm">
            <div className="rounded-md border border-border p-3 grid gap-2">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Plant / Equipment</span>
                <span className="font-medium text-right">{preview.plant_label}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Project</span>
                <span className="font-medium text-right">{preview.project_label}</span>
              </div>
            </div>

            {preview.conflict ? (
              <div className="flex items-start gap-2 text-xs p-3 rounded border border-destructive/40 bg-destructive/10 text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold m-0">
                    Rego conflict — tagging is blocked
                  </p>
                  <p className="m-0 mt-1">
                    Rego {preview.placa} is active on {preview.conflict_count} plant items
                    {preview.conflict_names.length
                      ? ` (${preview.conflict_names.slice(0, 3).join(", ")}${
                          preview.conflict_count > 3 ? ", …" : ""
                        })`
                      : ""}
                    . Ask an admin to clear or change the duplicate rego on one of those plant items first.
                  </p>
                </div>
              </div>
            ) : preview.backfill_count > 0 ? (
              <div className="text-xs p-3 rounded border border-primary/40 bg-primary/10 text-foreground space-y-2">
                <p className="m-0">
                  Rego <strong>{preview.placa}</strong> appears on{" "}
                  <strong>{preview.backfill_count + 1}</strong> deliver
                  {preview.backfill_count === 0 ? "y" : "ies"}. How should we tag
                  them to <strong>{preview.plant_item_name}</strong>?
                </p>
                <div className="grid gap-1.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tag-scope"
                      className="mt-0.5"
                      checked={scope === "single"}
                      onChange={() => setScope("single")}
                    />
                    <span>
                      <strong>Just this one</strong> — leave the other{" "}
                      {preview.backfill_count} untagged. Use this when a shared
                      job code is split between multiple machines.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tag-scope"
                      className="mt-0.5"
                      checked={scope === "all"}
                      onChange={() => setScope("all")}
                    />
                    <span>
                      <strong>All {preview.backfill_count + 1}</strong> with this
                      rego — auto-tag the matching deliveries too.
                    </span>
                  </label>
                </div>
              </div>
            ) : preview.plant_item_name ? (
              <p className="text-xs text-muted-foreground">
                No other untagged deliveries match this plant item's rego.
              </p>
            ) : null}
          </div>
        ) : (
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
              <div className="mt-2 grid gap-2 p-3 rounded-md border border-border bg-muted/30">
                <div>
                  <Label className="text-[11px]">Project name *</Label>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Westgate Tunnel — Stage 2"
                    autoFocus
                  />
                  {duplicateProject && (
                    <div className="mt-2 flex items-start gap-2 text-xs p-2 rounded border border-destructive/40 bg-destructive/10 text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="m-0 font-medium">
                          "{duplicateProject.name}" already exists for this customer.
                        </p>
                        <button
                          type="button"
                          className="mt-1 underline font-semibold"
                          onClick={() => {
                            setProjectId(duplicateProject.id);
                            setNewProjectName("");
                            setNewProjectSite("");
                            setNewProjectCode("");
                            setNewProjectStart("");
                            setNewProjectEnd("");
                          }}
                        >
                          Use existing project instead
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Job code</Label>
                    <Input
                      value={newProjectCode}
                      onChange={(e) => setNewProjectCode(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Site address</Label>
                    <Input
                      value={newProjectSite}
                      onChange={(e) => setNewProjectSite(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Start date</Label>
                    <Input
                      type="date"
                      value={newProjectStart}
                      onChange={(e) => setNewProjectStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">End date</Label>
                    <Input
                      type="date"
                      value={newProjectEnd}
                      onChange={(e) => setNewProjectEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        <DialogFooter>
          {preview ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setPreview(null)}
                disabled={upsert.isPending || creatingProject}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={upsert.isPending || creatingProject || preview.conflict}
              >
                {upsert.isPending || creatingProject ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Applying…
                  </>
                ) : (
                  "Confirm & Apply"
                )}
              </Button>
            </>
          ) : (
            <>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={previewing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReview}
            disabled={
              previewing ||
              !clientId ||
              (!plantItemId && !projectId)
            }
          >
            {previewing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Review &amp; Tag
              </>
            )}
          </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}