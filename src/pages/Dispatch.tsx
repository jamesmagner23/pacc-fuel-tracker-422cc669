import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Plus, Zap, GripVertical, Trash2, X, Package, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TruckMap } from "@/components/TruckMap";
import { useSchedule, useCreateOrder, useOptimise, useReorderStops, useDeleteOrder } from "@/hooks/useDispatch";
import { useDragReorder } from "@/hooks/useDragReorder";
import { useDemo } from "@/hooks/useDemo";
import { DEMO_CLIENT_ACCOUNTS } from "@/data/demoData";
import { toast } from "sonner";

function useClientAccounts() {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["client-accounts-dispatch", isDemo],
    queryFn: async () => {
      if (isDemo) return DEMO_CLIENT_ACCOUNTS.map((c) => ({ id: c.id, company_name: c.company_name }));
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function cssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function useThemeColors() {
  const surface = cssVar("--surface", "#4A3525");
  const border = cssVar("--surface-border", "#6B5240");
  const textPrimary = cssVar("--text-primary", "#F5E6D0");
  const textSecondary = cssVar("--text-secondary", "#C4A882");
  const textMuted = cssVar("--text-muted", "#8B7355");
  const accent = cssVar("--accent", "#E8461E");
  const surfaceHover = cssVar("--surface-hover", "#5A4535");
  return { surface, border, textPrimary, textSecondary, textMuted, accent, surfaceHover };
}

type StopStatus = "scheduled" | "on_route" | "completed" | "failed";

function StatusChip({ status }: { status: StopStatus }) {
  const colors: Record<StopStatus, { bg: string; text: string; label: string }> = {
    scheduled: { bg: "rgba(139,115,85,0.2)", text: "#C4A882", label: "Scheduled" },
    on_route: { bg: "rgba(59,130,246,0.15)", text: "#60A5FA", label: "On Route" },
    completed: { bg: "rgba(16,185,129,0.15)", text: "#10B981", label: "Completed" },
    failed: { bg: "rgba(239,68,68,0.15)", text: "#EF4444", label: "Failed" },
  };
  const c = colors[status] || colors.scheduled;
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

export default function Dispatch() {
  const [date, setDate] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const dateStr = format(date, "yyyy-MM-dd");
  const tc = useThemeColors();

  const { data: schedule, isLoading } = useSchedule(dateStr);
  const { data: clients = [] } = useClientAccounts();
  const createOrder = useCreateOrder();
  const optimise = useOptimise();
  const reorderStops = useReorderStops();
  const deleteOrder = useDeleteOrder();

  // Form state
  const [formClient, setFormClient] = useState("");
  const [formSite, setFormSite] = useState("");
  const [formLitres, setFormLitres] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [formTimeFrom, setFormTimeFrom] = useState("");
  const [formTimeTo, setFormTimeTo] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const stops = useMemo(() => {
    if (!schedule?.routes?.length) return [];
    const route = schedule.routes[0];
    return (route.stops || []).map((s: any, i: number) => ({
      seq: i + 1,
      orderNo: s.orderNo,
      clientName: s.location?.name || s.orderNo || `Stop ${i + 1}`,
      address: s.location?.address || "",
      litres: s.duration || 0,
      status: (s.status?.toLowerCase() || "scheduled") as StopStatus,
    }));
  }, [schedule]);

  const totalStops = stops.length;
  const completedStops = stops.filter((s: any) => s.status === "completed").length;
  const remainingStops = totalStops - completedStops;

  const handleCreateOrder = () => {
    if (!formClient || !formSite) {
      toast.error("Client and site address are required");
      return;
    }
    const client = clients.find((c) => String(c.id) === formClient);
    createOrder.mutate(
      {
        orderNo: `PACC-${Date.now()}`,
        date: dateStr,
        location: {
          name: client?.company_name || formClient,
          address: formSite,
        },
        duration: formLitres ? parseInt(formLitres) : 30,
        priority: formPriority,
        timeWindow: formTimeFrom && formTimeTo ? { tw1: { timeFrom: formTimeFrom, timeTo: formTimeTo } } : undefined,
        notes: formNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Order added to schedule");
          setShowForm(false);
          setFormClient("");
          setFormSite("");
          setFormLitres("");
          setFormPriority("medium");
          setFormTimeFrom("");
          setFormTimeTo("");
          setFormNotes("");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleOptimise = () => {
    optimise.mutate(dateStr, {
      onSuccess: () => toast.success("Route optimisation triggered"),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleReorder = (reordered: typeof stops) => {
    const orders = reordered.map((s, i) => ({
      orderNo: s.orderNo,
      sequence: i + 1,
    }));
    reorderStops.mutate(orders, {
      onError: (err) => toast.error(err.message),
    });
  };

  const { getDragProps, getItemStyle } = useDragReorder({
    items: stops,
    onReorder: handleReorder,
    canDrag: (item) => item.status !== "completed",
  });

  const handleDelete = (orderNo: string) => {
    deleteOrder.mutate([orderNo], {
      onSuccess: () => toast.success("Stop removed"),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="flex flex-col gap-1 max-w-[1200px]">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:px-6"
        style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12 }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: tc.textPrimary }}>Dispatch</h1>
          <p className="text-[11px]" style={{ color: tc.textSecondary }}>Manage today's delivery schedule</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-8 text-xs gap-1.5 border-surface-border bg-transparent",
                  "hover:bg-surface-hover"
                )}
                style={{ color: tc.textSecondary, borderColor: tc.border }}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                {format(date, "dd MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-surface border-surface-border" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            className="h-8 text-xs gap-1.5"
            style={{ color: tc.accent, borderColor: tc.accent }}
            onClick={handleOptimise}
            disabled={optimise.isPending}
          >
            <Zap className="w-3.5 h-3.5" />
            {optimise.isPending ? "Optimising…" : "Optimise Route"}
          </Button>
          <Button
            className="h-8 text-xs gap-1.5"
            style={{ background: tc.accent, color: "#fff" }}
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="w-3.5 h-3.5" />
            New Order
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-[1px]">
        {[
          { label: "Total Stops", value: totalStops, icon: <Package className="w-4 h-4" /> },
          { label: "Completed", value: completedStops, icon: <CheckCircle2 className="w-4 h-4" style={{ color: "#10B981" }} /> },
          { label: "Remaining", value: remainingStops, icon: <Clock className="w-4 h-4" style={{ color: tc.accent }} /> },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 sm:p-5"
            style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: tc.textSecondary }}>
                {kpi.label}
              </span>
              <span style={{ color: tc.textMuted }}>{kpi.icon}</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: tc.textPrimary }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* New Order form */}
      {showForm && (
        <div
          className="p-4 sm:p-5"
          style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12 }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium" style={{ color: tc.textPrimary }}>New Delivery Order</span>
            <button onClick={() => setShowForm(false)} style={{ color: tc.textMuted, background: "none", border: "none", cursor: "pointer" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Client</label>
              <Select value={formClient} onValueChange={setFormClient}>
                <SelectTrigger className="h-9 bg-transparent border-surface-border text-xs" style={{ color: tc.textPrimary }}>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent className="bg-surface border-surface-border">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Site Address</label>
              <Input
                className="h-9 bg-transparent border-surface-border text-xs"
                style={{ color: tc.textPrimary }}
                value={formSite}
                onChange={(e) => setFormSite(e.target.value)}
                placeholder="123 Example Rd, Melbourne"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Estimated Litres</label>
              <Input
                type="number"
                className="h-9 bg-transparent border-surface-border text-xs"
                style={{ color: tc.textPrimary }}
                value={formLitres}
                onChange={(e) => setFormLitres(e.target.value)}
                placeholder="3000"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Priority</label>
              <Select value={formPriority} onValueChange={setFormPriority}>
                <SelectTrigger className="h-9 bg-transparent border-surface-border text-xs" style={{ color: tc.textPrimary }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface border-surface-border">
                  <SelectItem value="high" className="text-xs">High</SelectItem>
                  <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                  <SelectItem value="low" className="text-xs">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Time Window From</label>
              <Input
                type="time"
                className="h-9 bg-transparent border-surface-border text-xs"
                style={{ color: tc.textPrimary }}
                value={formTimeFrom}
                onChange={(e) => setFormTimeFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Time Window To</label>
              <Input
                type="time"
                className="h-9 bg-transparent border-surface-border text-xs"
                style={{ color: tc.textPrimary }}
                value={formTimeTo}
                onChange={(e) => setFormTimeTo(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Notes</label>
              <Input
                className="h-9 bg-transparent border-surface-border text-xs"
                style={{ color: tc.textPrimary }}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Access via rear gate, call ahead..."
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button
              className="h-8 text-xs"
              style={{ background: tc.accent, color: "#fff" }}
              onClick={handleCreateOrder}
              disabled={createOrder.isPending}
            >
              {createOrder.isPending ? "Adding…" : "Add to Schedule"}
            </Button>
            <Button
              variant="outline"
              className="h-8 text-xs"
              style={{ color: tc.textSecondary, borderColor: tc.border }}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Two-column: Stop list + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[1px]">
        {/* Stop list */}
        <div
          className="p-4 sm:p-5"
          style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12 }}
        >
          <div className="text-sm font-medium mb-1" style={{ color: tc.textPrimary }}>Route Stops</div>
          <div className="text-[11px] mb-4" style={{ color: tc.textSecondary }}>
            {format(date, "EEEE, dd MMM yyyy")} · {totalStops} stops
          </div>

          {isLoading ? (
            <div className="text-xs py-8 text-center" style={{ color: tc.textSecondary }}>Loading schedule…</div>
          ) : stops.length === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: tc.textSecondary }}>
              No stops scheduled. Add orders or sync with OptimoRoute.
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-h-[460px] overflow-y-auto pr-1">
              {stops.map((stop: any, idx: number) => {
                const isCompleted = stop.status === "completed";
                const dragProps = getDragProps(idx);
                const itemStyle = getItemStyle(idx);
                return (
                  <div
                    key={stop.orderNo || idx}
                    {...dragProps}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                    style={{
                      border: `1px solid ${tc.border}`,
                      opacity: isCompleted ? 0.5 : itemStyle.opacity,
                      borderTop: itemStyle.borderTop,
                      borderBottom: itemStyle.borderBottom,
                      cursor: isCompleted ? "default" : itemStyle.cursor,
                    }}
                    onMouseEnter={(e) => { if (!isCompleted) e.currentTarget.style.background = tc.surfaceHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Drag handle */}
                    {!isCompleted && (
                      <div className="shrink-0 touch-none" style={{ color: tc.textMuted, cursor: "grab" }}>
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}

                    {/* Sequence */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: isCompleted ? "rgba(16,185,129,0.15)" : `${tc.accent}22`,
                        color: isCompleted ? "#10B981" : tc.accent,
                      }}
                    >
                      {stop.seq}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: tc.textPrimary }}>{stop.clientName}</div>
                      <div className="text-[10px] truncate" style={{ color: tc.textSecondary }}>{stop.address || "—"}</div>
                      {stop.litres > 0 && (
                        <div className="text-[10px] mt-0.5" style={{ color: tc.textMuted }}>{stop.litres.toLocaleString()}L est.</div>
                      )}
                    </div>

                    {/* Status */}
                    <StatusChip status={stop.status} />

                    {/* Delete */}
                    {!isCompleted && (
                      <button
                        onClick={() => handleDelete(stop.orderNo)}
                        className="p-1 rounded hover:bg-red-500/10"
                        style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Map */}
        <div>
          <TruckMap height={500} showStops={true} />
        </div>
      </div>
    </div>
  );
}
