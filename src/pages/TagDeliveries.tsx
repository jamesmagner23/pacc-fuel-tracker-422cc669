import { useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Tag as TagIcon, X, Search, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import {
  useTransactionOverrides,
  useUpsertTransactionOverride,
  useDeleteTransactionOverride,
} from "@/hooks/useTransactionOverrides";
import { TagDeliveryModal } from "@/components/driver/TagDeliveryModal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePlantItems } from "@/hooks/usePlantItems";
import { useProjects } from "@/hooks/useProjects";

type FilterMode = "all" | "untagged" | "tagged";

function useRecentTransactions(days: number) {
  const fromDate = format(subDays(new Date(), days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["admin-recent-transactions", fromDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, fecha, date, nombre_cliente1, placa, cantidad, factura, estacion, ppu, dinero_total")
        .gte("fecha", `${fromDate}T00:00:00`)
        .order("fecha", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
}

function useAllClientAccounts() {
  return useQuery({
    queryKey: ["admin-client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name, speedsol_names")
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });
}

const NONE = "__none__";

/** Bulk-tag dialog: applies one plant/project to many transactions at once. */
function BulkTagModal({
  open,
  onOpenChange,
  selected,
  clients,
  defaultClientId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: { id: number; nombre_cliente1: string | null }[];
  clients: { id: number; company_name: string; speedsol_names?: string[] | null }[];
  defaultClientId: number | null;
  onDone: () => void;
}) {
  const [clientId, setClientId] = useState<number | null>(defaultClientId);
  const [plantItemId, setPlantItemId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const upsert = useUpsertTransactionOverride();

  const { data: plantItems = [] } = usePlantItems(clientId);
  const { data: projects = [] } = useProjects(clientId);

  const handleApply = async () => {
    if (!selected.length) return;
    if (!plantItemId && !projectId) {
      toast.error("Pick a plant item or project (or both).");
      return;
    }
    setRunning(true);
    let ok = 0, fail = 0;
    for (const t of selected) {
      try {
        await upsert.mutateAsync({
          transaction_id: Number(t.id),
          plant_item_id: plantItemId === NONE || !plantItemId ? null : plantItemId,
          project_id: projectId === NONE || !projectId ? null : projectId,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setRunning(false);
    toast.success(`Tagged ${ok} delivery${ok === 1 ? "" : "s"}${fail ? ` · ${fail} failed` : ""}`);
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Tag {selected.length} Deliveries</DialogTitle>
        </DialogHeader>

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
          </div>

          <div>
            <Label>Plant / Equipment</Label>
            <Select
              value={plantItemId || NONE}
              onValueChange={(v) => setPlantItemId(v === NONE ? "" : v)}
              disabled={!clientId}
            >
              <SelectTrigger>
                <SelectValue placeholder={clientId ? "Pick equipment" : "Pick a client first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {plantItems.map((pi) => (
                  <SelectItem key={pi.id} value={pi.id}>
                    {pi.name}{pi.placa ? ` · ${pi.placa}` : ""}
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
                <SelectValue placeholder={clientId ? "Pick project" : "Pick a client first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-[11px] text-muted-foreground">
            This will overwrite existing tags on all {selected.length} selected deliveries.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={running || !clientId}>
            {running ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Applying…</>
            ) : (
              `Apply to ${selected.length}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TagDeliveries() {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [days, setDays] = useState<number>(30);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [target, setTarget] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data: txns = [], isLoading } = useRecentTransactions(days);
  const { data: clients = [] } = useAllClientAccounts();

  const ids = useMemo(() => txns.map((t: any) => t.id as number), [txns]);
  const { data: overrides = {} } = useTransactionOverrides(ids);
  const clearOverride = useDeleteTransactionOverride();

  const speedsolToClient = useMemo(() => {
    const m: Record<string, number> = {};
    clients.forEach((c: any) => {
      (c.speedsol_names || []).forEach((n: string) => (m[n] = c.id));
    });
    return m;
  }, [clients]);

  const visible = useMemo(() => {
    return txns.filter((t: any) => {
      const isTagged = !!overrides[t.id];
      if (filter === "untagged" && isTagged) return false;
      if (filter === "tagged" && !isTagged) return false;

      if (clientFilter !== "all" && t.nombre_cliente1 !== clientFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const blob = `${t.nombre_cliente1 || ""} ${t.placa || ""} ${t.factura || ""} ${t.estacion || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [txns, overrides, filter, search, clientFilter]);

  const taggedCount = txns.filter((t: any) => overrides[t.id]).length;
  const untaggedCount = txns.length - taggedCount;

  const uniqueClients = useMemo(() => {
    const s = new Set<string>();
    txns.forEach((t: any) => t.nombre_cliente1 && s.add(t.nombre_cliente1));
    return Array.from(s).sort();
  }, [txns]);

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = visible.length > 0 && visible.every((t: any) => selected.has(t.id));
  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((t: any) => t.id)));
    }
  };

  const selectedTxns = useMemo(
    () => txns.filter((t: any) => selected.has(t.id)),
    [txns, selected]
  );

  // Default client for bulk: if all selected share one speedsol name, use that mapping
  const bulkDefaultClient = useMemo<number | null>(() => {
    if (!selectedTxns.length) return null;
    const names = new Set(selectedTxns.map((t: any) => t.nombre_cliente1));
    if (names.size !== 1) return null;
    const name = [...names][0];
    return speedsolToClient[name as string] ?? null;
  }, [selectedTxns, speedsolToClient]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tag Deliveries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manually assign deliveries to plant items and projects. Faster and more reliable than auto-matching while volumes are small.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-xl font-bold tabular-nums">{txns.length}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tagged</p>
          <p className="text-xl font-bold tabular-nums text-accent">{taggedCount}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Untagged</p>
          <p className="text-xl font-bold tabular-nums">{untaggedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 rounded-md border border-surface-border">
          {([
            { k: "all", label: "All" },
            { k: "untagged", label: "Untagged" },
            { k: "tagged", label: "Tagged" },
          ] as const).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
                filter === k ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ minHeight: 36 }}
            >
              {label}
            </button>
          ))}
        </div>

        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 6 months</SelectItem>
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {uniqueClients.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rego, invoice, station…"
            className="h-9 text-xs pl-8"
          />
        </div>
      </div>

      {/* Bulk action bar (sticky when selection active) */}
      {selected.size > 0 && (
        <div className="card p-3 flex items-center justify-between flex-wrap gap-2 border-accent/40 bg-accent/5">
          <div className="text-sm">
            <span className="font-semibold">{selected.size}</span> delivery{selected.size === 1 ? "" : "s"} selected
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              Bulk Tag…
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading deliveries…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center">
          <TagIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground m-0">
            No deliveries match these filters.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Header row with select-all */}
          <div className="px-4 py-2 border-b border-surface-border flex items-center gap-3 bg-muted/20">
            <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
              {allVisibleSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {visible.length} shown
            </span>
          </div>

          {visible.map((t: any) => {
            const ov = overrides[t.id];
            const placa = (t.placa || "").trim();
            const clientId = speedsolToClient[t.nombre_cliente1 || ""] ?? null;
            const isSel = selected.has(t.id);
            return (
              <div
                key={t.id}
                className={`px-4 py-3 flex items-center gap-3 border-b border-surface-border last:border-0 transition-colors ${
                  isSel ? "bg-accent/5" : ""
                }`}
              >
                <Checkbox
                  checked={isSel}
                  onCheckedChange={() => toggleOne(t.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">
                      {t.nombre_cliente1 || "Unknown"}
                    </span>
                    {placa && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {placa}
                      </Badge>
                    )}
                    {ov ? (
                      <Badge className="text-[10px] bg-accent text-white border-0">Tagged</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Untagged</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t.fecha ? format(parseISO(t.fecha), "EEE dd MMM HH:mm") : "—"}
                    {t.factura ? ` · #${t.factura}` : ""} ·{" "}
                    {(t.cantidad || 0).toLocaleString()}L
                    {t.estacion ? ` · ${t.estacion}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {ov && (
                    <button
                      onClick={() => {
                        if (confirm("Remove tag from this delivery?")) {
                          clearOverride.mutate(t.id, {
                            onError: (e: any) => toast.error(e.message),
                          });
                        }
                      }}
                      title="Clear tag"
                      className="rounded border border-surface-border bg-transparent text-muted-foreground p-1.5 hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <Button
                    size="sm"
                    variant={ov ? "outline" : "default"}
                    onClick={() => setTarget({ ...t, _clientAccountId: clientId })}
                    className="h-8 text-xs"
                  >
                    {ov ? "Edit" : "Tag"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TagDeliveryModal
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        transaction={target}
        clients={clients}
        currentOverride={target ? overrides[target.id] : undefined}
      />

      <BulkTagModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selected={selectedTxns as any}
        clients={clients}
        defaultClientId={bulkDefaultClient}
        onDone={() => setSelected(new Set())}
      />
    </div>
  );
}