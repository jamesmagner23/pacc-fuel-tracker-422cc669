import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, GripVertical, Trash2, Package, CheckCircle2, Clock, MapPin, Navigation, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TruckMap } from "@/components/TruckMap";
import { useDispatchStops, useDeleteStop, useReorderDispatchStops, useUpdateStopStatus, type DispatchStop } from "@/hooks/useDispatch";
import { useTrucks } from "@/hooks/useTrucks";
import { useDragReorder } from "@/hooks/useDragReorder";
import { AddToDispatchDialog } from "@/components/dispatch/AddToDispatchDialog";
import { LogStopsDialog } from "@/components/dispatch/LogStopsDialog";
import { toast } from "sonner";

function googleMapsUrl(stops: DispatchStop[]) {
  const points = stops
    .filter((s) => s.address && s.status !== "completed" && s.status !== "cancelled")
    .map((s) => encodeURIComponent(s.address!));
  if (!points.length) return null;
  const dest = points[points.length - 1];
  const wps = points.slice(0, -1).join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${wps ? `&waypoints=${wps}` : ""}&travelmode=driving`;
}

function StatusBadge({ s }: { s: DispatchStop["status"] }) {
  const map = {
    scheduled: { label: "Scheduled", cls: "bg-muted text-muted-foreground" },
    in_progress: { label: "On route", cls: "bg-primary/15 text-primary" },
    completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-500" },
    cancelled: { label: "Cancelled", cls: "bg-destructive/15 text-destructive" },
  } as const;
  const c = map[s];
  return <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${c.cls}`}>{c.label}</span>;
}

function useClientName(id: number | null) {
  return useQuery({
    queryKey: ["client-name", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("client_accounts").select("company_name").eq("id", id!).maybeSingle();
      return (data as any)?.company_name as string | undefined;
    },
  });
}

function useClientList() {
  return useQuery({
    queryKey: ["client-accounts-min"],
    queryFn: async () => {
      const { data } = await supabase.from("client_accounts").select("id, company_name").eq("is_active", true).order("company_name");
      return (data || []) as { id: number; company_name: string }[];
    },
  });
}

function StopRow({ stop, idx, dragProps, itemStyle, clientNameById, truckNameById, onDelete, onComplete }: any) {
  const isDone = stop.status === "completed";
  return (
    <div
      {...(isDone ? {} : dragProps)}
      className={cn("flex items-center gap-3 p-3 rounded-lg border border-border", isDone && "opacity-50")}
      style={{
        opacity: isDone ? 0.5 : itemStyle.opacity,
        borderTop: itemStyle.borderTop,
        borderBottom: itemStyle.borderBottom,
        cursor: isDone ? "default" : itemStyle.cursor,
      }}
    >
      {!isDone && <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />}
      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
        {idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">
          {stop.site_name}
          {clientNameById[stop.client_account_id] && (
            <span className="text-muted-foreground font-normal"> · {clientNameById[stop.client_account_id]}</span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{stop.address || "—"}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
          {stop.estimated_litres ? <span>{Number(stop.estimated_litres).toLocaleString()}L</span> : null}
          {stop.truck_id && truckNameById[stop.truck_id] && <span>· {truckNameById[stop.truck_id]}</span>}
        </div>
      </div>
      <StatusBadge s={stop.status} />
      {!isDone && (
        <>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onComplete(stop.id)} title="Mark complete">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => onDelete(stop.id)} title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

export default function Dispatch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = (() => {
    const q = searchParams.get("date");
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
      const [y, m, d] = q.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  })();
  const [date, setDate] = useState<Date>(initialDate);
  useEffect(() => {
    const q = searchParams.get("date");
    const cur = format(date, "yyyy-MM-dd");
    if (q && q !== cur && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
      const [y, m, d] = q.split("-").map(Number);
      setDate(new Date(y, m - 1, d));
    }
  }, [searchParams]);
  const [calOpen, setCalOpen] = useState(false);
  const [truckFilter, setTruckFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addClientId, setAddClientId] = useState<number | null>(null);
  const [logStopsOpen, setLogStopsOpen] = useState(false);

  const dateStr = format(date, "yyyy-MM-dd");
  const { data: trucks = [] } = useTrucks();
  const { data: clients = [] } = useClientList();
  const { data: allStops = [], isLoading } = useDispatchStops(dateStr);
  const del = useDeleteStop();
  const reorder = useReorderDispatchStops();
  const updateStatus = useUpdateStopStatus();

  const truckNameById = useMemo(() => Object.fromEntries(trucks.map((t) => [t.id, t.name])), [trucks]);
  const clientNameById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.company_name])), [clients]);

  const filteredStops = useMemo(() => {
    const list = truckFilter === "all" ? allStops : allStops.filter((s) => s.truck_id === truckFilter);
    return [...list].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  }, [allStops, truckFilter]);

  const totals = {
    total: filteredStops.length,
    completed: filteredStops.filter((s) => s.status === "completed").length,
    remaining: filteredStops.filter((s) => s.status !== "completed" && s.status !== "cancelled").length,
  };

  const handleReorder = (reordered: DispatchStop[]) => {
    reorder.mutate(
      reordered.map((s, i) => ({ id: s.id, sequence: i + 1 })),
      { onError: (e: any) => toast.error(e.message) }
    );
  };

  const { getDragProps, getItemStyle } = useDragReorder({
    items: filteredStops,
    onReorder: handleReorder,
    canDrag: (s: DispatchStop) => s.status !== "completed" && s.status !== "cancelled",
  });

  const mapsUrl = googleMapsUrl(filteredStops);

  return (
    <div className="flex flex-col gap-3 max-w-[1200px] w-full">
      {/* Header */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Dispatch</h1>
          <p className="text-[11px] text-muted-foreground">Plan stops, assign trucks, and route your day</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" /> {format(date, "dd MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setSearchParams({ date: format(d, "yyyy-MM-dd") }, { replace: true }); setCalOpen(false); } }} initialFocus />
            </PopoverContent>
          </Popover>
          <Select value={truckFilter} onValueChange={setTruckFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trucks</SelectItem>
              {trucks.filter((t) => t.is_active).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mapsUrl && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(mapsUrl, "_blank")}>
              <Navigation className="w-3.5 h-3.5" /> Route in Maps
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLogStopsOpen(true)}>
            <ListPlus className="w-3.5 h-3.5" /> Log Stops
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> New Stop
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total Stops", value: totals.total, icon: Package },
          { label: "Completed", value: totals.completed, icon: CheckCircle2 },
          { label: "Remaining", value: totals.remaining, icon: Clock },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</span>
              <k.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Add stop quick selector */}
      {addOpen && addClientId === null && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Pick a customer</span>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
          </div>
          <Select onValueChange={(v) => setAddClientId(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Search customer…" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stops + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Route Stops</div>
              <div className="text-[11px] text-muted-foreground">{format(date, "EEEE dd MMM yyyy")} · {totals.total} stops</div>
            </div>
          </div>
          {isLoading ? (
            <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
          ) : filteredStops.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No stops scheduled. Add one with <strong>New Stop</strong> or from a customer's project.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
              {filteredStops.map((s, idx) => (
                <StopRow
                  key={s.id}
                  stop={s}
                  idx={idx}
                  dragProps={getDragProps(idx)}
                  itemStyle={getItemStyle(idx)}
                  clientNameById={clientNameById}
                  truckNameById={truckNameById}
                  onDelete={(id: string) => del.mutate(id)}
                  onComplete={(id: string) => updateStatus.mutate({ id, status: "completed" })}
                />
              ))}
            </div>
          )}
        </div>
        <div className="min-h-[300px]">
          <TruckMap height={500} showStops={true} />
        </div>
      </div>

      {addClientId && (
        <AddToDispatchDialog
          open={true}
          onOpenChange={(v) => { if (!v) { setAddClientId(null); setAddOpen(false); } }}
          clientAccountId={addClientId}
          clientName={clientNameById[addClientId]}
        />
      )}

      <LogStopsDialog open={logStopsOpen} onOpenChange={setLogStopsOpen} defaultDate={date} />
    </div>
  );
}
