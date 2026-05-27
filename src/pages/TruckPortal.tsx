import { useMemo, useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { toast } from "sonner";
import {
  Truck as TruckIcon, FileText, Wrench, ShieldAlert, BarChart3,
  Plus, Trash2, Download, Loader2, Pencil, Upload, RefreshCcw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useTrucks, useUpsertTruck, Truck,
  useTruckDocuments, useUpsertTruckDocument, useDeleteTruckDocument,
  useTruckServiceRecords, useUpsertTruckServiceRecord, useDeleteTruckServiceRecord,
  uploadTruckDoc, getTruckDocSignedUrl,
} from "@/hooks/useTrucks";
import { useDateRange } from "@/hooks/useDateRange";
import { useTransactions, useAllTransactions } from "@/hooks/useTransactions";
import { useChartPalette } from "@/lib/chartPalette";
import { DateRangeToggle } from "@/components/DateRangeToggle";
import { useSyncTransactions } from "@/hooks/useSyncTransactions";

const DOC_TYPES = [
  "Tank Certification",
  "Registration",
  "Insurance",
  "Dangerous Goods Licence",
  "Pump Calibration",
  "Roadworthy",
  "Risk Assessment",
  "SOP",
  "Other",
];

function expiryStatus(expiry: string | null): { label: string; tone: "ok" | "warn" | "bad" | "none" } {
  if (!expiry) return { label: "—", tone: "none" };
  const days = differenceInDays(parseISO(expiry), new Date());
  if (days < 0) return { label: `Expired ${-days}d ago`, tone: "bad" };
  if (days <= 30) return { label: `${days}d left`, tone: "warn" };
  return { label: `${days}d left`, tone: "ok" };
}

export default function TruckPortal() {
  const { data: trucks = [], isLoading } = useTrucks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Truck> | null>(null);

  const selected = useMemo(
    () => trucks.find((t) => t.id === selectedId) || trucks[0] || null,
    [trucks, selectedId],
  );

  return (
    <div className="flex flex-col gap-5 max-w-[1200px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TruckIcon className="w-5 h-5 text-accent" />
            Truck Portal
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Fleet identity, compliance, service history and sales attribution.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({})}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Truck
        </Button>
      </div>

      {/* Truck selector */}
      <div className="flex gap-2 flex-wrap">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : trucks.length === 0 ? (
          <div className="card p-6 text-sm text-muted-foreground">No trucks yet. Click <strong>Add Truck</strong>.</div>
        ) : (
          trucks.map((t) => {
            const isActive = selected?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className="card px-4 py-3 text-left transition-colors min-w-[180px]"
                style={{
                  borderColor: isActive ? "var(--primary)" : "var(--surface-border)",
                  background: isActive ? "var(--accent-light)" : undefined,
                  color: isActive ? "var(--primary)" : undefined,
                }}
              >
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: isActive ? "var(--primary)" : "var(--text-secondary)", opacity: isActive ? 0.85 : 1 }}>
                  {t.rego || "No rego"} {t.tank_capacity_litres ? `· ${t.tank_capacity_litres.toLocaleString()}L` : ""}
                </div>
              </button>
            );
          })
        )}
      </div>

      {selected && (
        <TruckDetail
          truck={selected}
          onEdit={() => setEditing(selected)}
        />
      )}

      {editing && (
        <TruckEditModal
          truck={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function TruckDetail({ truck, onEdit }: { truck: Truck; onEdit: () => void }) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0 overflow-x-auto flex-nowrap w-full no-scrollbar">
        {[
          { v: "overview", label: "Overview", icon: TruckIcon },
          { v: "compliance", label: "Compliance", icon: ShieldAlert },
          { v: "service", label: "Service", icon: Wrench },
          { v: "docs", label: "Risk & SOPs", icon: FileText },
          { v: "sales", label: "Sales", icon: BarChart3 },
        ].map((t) => (
          <TabsTrigger
            key={t.v}
            value={t.v}
            className="px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-5">
        <OverviewPanel truck={truck} onEdit={onEdit} />
      </TabsContent>
      <TabsContent value="compliance" className="mt-5">
        <DocumentsPanel truck={truck} filterTypes={[
          "Tank Certification", "Registration", "Insurance",
          "Dangerous Goods Licence", "Pump Calibration", "Roadworthy", "Other",
        ]} title="Compliance Documents" />
      </TabsContent>
      <TabsContent value="service" className="mt-5">
        <ServicePanel truck={truck} />
      </TabsContent>
      <TabsContent value="docs" className="mt-5">
        <DocumentsPanel truck={truck} filterTypes={["Risk Assessment", "SOP"]} title="Risk Assessments & SOPs" />
      </TabsContent>
      <TabsContent value="sales" className="mt-5">
        <SalesPanel truck={truck} />
      </TabsContent>
    </Tabs>
  );
}

/* ────────── Overview ────────── */

function OverviewPanel({ truck, onEdit }: { truck: Truck; onEdit: () => void }) {
  const fields: { label: string; value: string | number | null }[] = [
    { label: "Rego", value: truck.rego },
    { label: "SpeedSol Estación", value: truck.speedsol_estacion },
    { label: "Make", value: truck.make },
    { label: "Model", value: truck.model },
    { label: "VIN", value: truck.vin },
    { label: "Serial", value: truck.serial_number },
    { label: "Tank Capacity", value: truck.tank_capacity_litres ? `${truck.tank_capacity_litres.toLocaleString()} L` : null },
    { label: "Build Date", value: truck.build_date ? format(parseISO(truck.build_date), "d MMM yyyy") : null },
    { label: "Current km", value: truck.current_km ? truck.current_km.toLocaleString() : null },
    { label: "Last Service", value: truck.last_service_date ? `${format(parseISO(truck.last_service_date), "d MMM yyyy")}${truck.last_service_km ? ` · ${truck.last_service_km.toLocaleString()} km` : ""}` : null },
    { label: "Next Service", value: truck.next_service_date ? `${format(parseISO(truck.next_service_date), "d MMM yyyy")}${truck.next_service_km ? ` · ${truck.next_service_km.toLocaleString()} km` : ""}` : null },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-base font-semibold">{truck.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {truck.is_active ? "Active" : "Inactive"}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
        {fields.map((f) => (
          <div key={f.label}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
            <div className="text-sm font-medium tabular-nums">{f.value || "—"}</div>
          </div>
        ))}
      </div>

      {truck.notes && (
        <div className="mt-5 pt-4 border-t border-surface-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
          <div className="text-sm whitespace-pre-wrap">{truck.notes}</div>
        </div>
      )}
    </div>
  );
}

/* ────────── Documents (compliance + risk/SOP) ────────── */

function DocumentsPanel({
  truck, filterTypes, title,
}: {
  truck: Truck; filterTypes: string[]; title: string;
}) {
  const { data: docs = [], isLoading } = useTruckDocuments(truck.id);
  const del = useDeleteTruckDocument();
  const [adding, setAdding] = useState(false);

  const visible = docs.filter((d) => filterTypes.includes(d.doc_type));

  const open = async (path: string | null) => {
    if (!path) return;
    const url = await getTruckDocSignedUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open file");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Document
        </Button>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted-foreground">
          No documents yet.
        </div>
      ) : (
        <div className="card divide-y divide-surface-border" style={{ padding: 0 }}>
          {visible.map((d) => {
            const status = expiryStatus(d.expiry_date);
            return (
              <div key={d.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-[180px]">
                  <div className="text-sm font-medium">{d.label || d.doc_type}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.doc_type}
                    {d.issue_date ? ` · Issued ${format(parseISO(d.issue_date), "d MMM yyyy")}` : ""}
                    {d.expiry_date ? ` · Expires ${format(parseISO(d.expiry_date), "d MMM yyyy")}` : ""}
                  </div>
                </div>
                {status.tone !== "none" && (
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{
                      color: status.tone === "bad" ? "var(--negative)" : status.tone === "warn" ? "var(--warning)" : "var(--positive)",
                      borderColor: "currentColor",
                    }}
                  >
                    {status.label}
                  </Badge>
                )}
                {d.file_path && (
                  <Button size="sm" variant="ghost" onClick={() => open(d.file_path)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost"
                  onClick={() => {
                    if (confirm("Delete this document?")) {
                      del.mutate({ id: d.id, truck_id: truck.id });
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <DocumentEditModal
          truckId={truck.id}
          allowedTypes={filterTypes}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function DocumentEditModal({
  truckId, allowedTypes, onClose,
}: { truckId: string; allowedTypes: string[]; onClose: () => void }) {
  const upsert = useUpsertTruckDocument();
  const [docType, setDocType] = useState(allowedTypes[0]);
  const [label, setLabel] = useState("");
  const [issue, setIssue] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      let path: string | null = null;
      if (file) path = await uploadTruckDoc(truckId, file);
      await upsert.mutateAsync({
        truck_id: truckId,
        doc_type: docType,
        label: label || null,
        file_path: path,
        issue_date: issue || null,
        expiry_date: expiry || null,
        notes: notes || null,
      });
      toast.success("Document saved");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Annual cert 2026" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Issue date</Label>
              <Input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
            </div>
            <div>
              <Label>Expiry date</Label>
              <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>File (PDF / image)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────── Service ────────── */

function ServicePanel({ truck }: { truck: Truck }) {
  const { data: records = [], isLoading } = useTruckServiceRecords(truck.id);
  const del = useDeleteTruckServiceRecord();
  const [adding, setAdding] = useState(false);

  const open = async (path: string | null) => {
    if (!path) return;
    const url = await getTruckDocSignedUrl(path);
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Service History</h3>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Service Record
        </Button>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
        </div>
      ) : records.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted-foreground">No service records yet.</div>
      ) : (
        <div className="card divide-y divide-surface-border" style={{ padding: 0 }}>
          {records.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-medium">
                  {r.service_type || "Service"} · {format(parseISO(r.service_date), "d MMM yyyy")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.vendor || "—"}
                  {r.service_km ? ` · ${r.service_km.toLocaleString()} km` : ""}
                  {r.cost ? ` · $${r.cost.toLocaleString()}` : ""}
                </div>
                {r.notes && <div className="text-[11px] text-muted-foreground mt-0.5">{r.notes}</div>}
              </div>
              {r.file_path && (
                <Button size="sm" variant="ghost" onClick={() => open(r.file_path)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                size="sm" variant="ghost"
                onClick={() => { if (confirm("Delete this record?")) del.mutate({ id: r.id, truck_id: truck.id }); }}
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {adding && <ServiceEditModal truckId={truck.id} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ServiceEditModal({ truckId, onClose }: { truckId: string; onClose: () => void }) {
  const upsert = useUpsertTruckServiceRecord();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [km, setKm] = useState("");
  const [type, setType] = useState("");
  const [vendor, setVendor] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      let path: string | null = null;
      if (file) path = await uploadTruckDoc(truckId, file);
      await upsert.mutateAsync({
        truck_id: truckId,
        service_date: date,
        service_km: km ? Number(km) : null,
        service_type: type || null,
        vendor: vendor || null,
        cost: cost ? Number(cost) : null,
        notes: notes || null,
        file_path: path,
      });
      toast.success("Service record saved");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Service Record</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Odometer (km)</Label>
              <Input type="number" value={km} onChange={(e) => setKm(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Type</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. 10,000 km service" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div>
              <Label>Cost ($)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Invoice / Report (optional)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────── Sales ────────── */

function SalesPanel({ truck }: { truck: Truck }) {
  const { range } = useDateRange();
  const palette = useChartPalette();
  const { data: filtered = [], isLoading } = useTransactions(range);
  const { data: allTxns = [] } = useAllTransactions();
  const { syncing, handleSync, lastSyncTime } = useSyncTransactions();

  const matcher = (t: { estacion: string | null }) =>
    t.estacion === (truck.speedsol_estacion || truck.name);

  const periodTxns = filtered.filter(matcher);
  const periodLitres = periodTxns.reduce((s, t) => s + (t.cantidad || 0), 0);
  const periodRevenue = periodTxns.reduce((s, t) => s + (t.dinero_total || 0), 0);
  const avgDrop = periodTxns.length ? Math.round(periodLitres / periodTxns.length) : 0;
  const totaliser = allTxns.find(matcher)?.totalizador_bruto || 0;

  const dailyMap: Record<string, number> = {};
  periodTxns.forEach((t) => { if (t.date) dailyMap[t.date] = (dailyMap[t.date] || 0) + (t.cantidad || 0); });
  const dailyData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, litres]) => ({ date: format(parseISO(date), "dd MMM"), litres }));

  const tooltipStyle = { backgroundColor: palette.surface, border: `1px solid ${palette.grid}`, borderRadius: 8, fontSize: 12 };

  if (isLoading) {
    return <div className="card p-6 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading…</div>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 flex-wrap rounded-[14px] border border-border bg-card p-4">
        <div className="mr-auto min-w-[220px]">
          <h3 className="text-sm font-semibold">Daily Fuel Sales</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {truck.name} · {lastSyncTime ? `last refreshed ${lastSyncTime}` : "not refreshed yet"}
          </p>
        </div>
        <Button size="sm" onClick={handleSync} disabled={syncing} className="min-h-10">
          <RefreshCcw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Refreshing…" : "Refresh data"}
        </Button>
        <div className="w-full sm:w-auto sm:min-w-[280px]">
          <DateRangeToggle />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Period Litres" value={`${(periodLitres / 1000).toFixed(1)}k L`} />
        <Stat label="Deliveries" value={periodTxns.length.toString()} />
        <Stat label="Avg Drop" value={`${avgDrop.toLocaleString()} L`} />
        <Stat label="Totaliser" value={`${totaliser.toLocaleString()} L`} />
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">
          Daily Litres — attributed via SpeedSol estación <code className="text-[11px]">{truck.speedsol_estacion || truck.name}</code>
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id={`tg-${truck.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.primary} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={palette.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: palette.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: palette.textMuted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()}L`, "Litres"]} />
              <Area type="monotone" dataKey="litres" stroke={palette.primary} fill={`url(#tg-${truck.id})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-1">Period Revenue</h3>
        <div className="text-2xl font-bold tabular-nums">${periodRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        <div className="text-[11px] text-muted-foreground mt-1">Inc. GST · from {periodTxns.length} deliveries</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

/* ────────── Truck edit modal ────────── */

function TruckEditModal({ truck, onClose }: { truck: Partial<Truck>; onClose: () => void }) {
  const upsert = useUpsertTruck();
  const [form, setForm] = useState<Partial<Truck>>(truck);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Truck>(k: K, v: Truck[K] | string) =>
    setForm((f) => ({ ...f, [k]: v === "" ? null : (v as any) }));

  const save = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await upsert.mutateAsync(form);
      toast.success("Truck saved");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{truck.id ? "Edit Truck" : "Add Truck"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name *"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Rego"><Input value={form.rego || ""} onChange={(e) => set("rego", e.target.value)} /></Field>
          </div>
          <Field label="SpeedSol estación (must match dispenser station name)">
            <Input value={form.speedsol_estacion || ""} onChange={(e) => set("speedsol_estacion", e.target.value)} placeholder="e.g. PACC Truck 2" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Make"><Input value={form.make || ""} onChange={(e) => set("make", e.target.value)} /></Field>
            <Field label="Model"><Input value={form.model || ""} onChange={(e) => set("model", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="VIN"><Input value={form.vin || ""} onChange={(e) => set("vin", e.target.value)} /></Field>
            <Field label="Serial"><Input value={form.serial_number || ""} onChange={(e) => set("serial_number", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tank Capacity (L)"><Input type="number" value={form.tank_capacity_litres ?? ""} onChange={(e) => set("tank_capacity_litres", e.target.value === "" ? null : Number(e.target.value) as any)} /></Field>
            <Field label="Build Date"><Input type="date" value={form.build_date || ""} onChange={(e) => set("build_date", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Current km"><Input type="number" value={form.current_km ?? ""} onChange={(e) => set("current_km", e.target.value === "" ? null : Number(e.target.value) as any)} /></Field>
            <Field label=""><span /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Last Service Date"><Input type="date" value={form.last_service_date || ""} onChange={(e) => set("last_service_date", e.target.value)} /></Field>
            <Field label="Last Service km"><Input type="number" value={form.last_service_km ?? ""} onChange={(e) => set("last_service_km", e.target.value === "" ? null : Number(e.target.value) as any)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Next Service Date"><Input type="date" value={form.next_service_date || ""} onChange={(e) => set("next_service_date", e.target.value)} /></Field>
            <Field label="Next Service km"><Input type="number" value={form.next_service_km ?? ""} onChange={(e) => set("next_service_km", e.target.value === "" ? null : Number(e.target.value) as any)} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={3} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <Label className="text-[11px]">{label}</Label>}
      {children}
    </div>
  );
}