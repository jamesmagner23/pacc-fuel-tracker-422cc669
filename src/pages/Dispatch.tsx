import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Plus, Zap, GripVertical, Trash2, X, Package, CheckCircle2, Clock, UserPlus, Loader2 } from "lucide-react";
import { DispatchAnalytics } from "@/components/dispatch/DispatchAnalytics";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TruckMap } from "@/components/TruckMap";
import { useSchedule, useCreateOrder, useOptimise, useReorderStops, useDeleteOrder, useLocations, usePlanningStatus } from "@/hooks/useDispatch";
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

function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: { company_name: string; contact_email?: string; contact_phone?: string }) => {
      const { data, error } = await supabase
        .from("client_accounts")
        .insert({
          company_name: client.company_name,
          contact_email: client.contact_email || `${client.company_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@pending.com`,
          contact_phone: client.contact_phone || null,
        })
        .select("id, company_name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-accounts-dispatch"] }),
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

function ClientCombobox({
  clients,
  value,
  clientName,
  onChange,
  onNewClient,
  colors,
}: {
  clients: { id: number; company_name: string }[];
  value: string;
  clientName: string;
  onChange: (clientId: string, clientName: string) => void;
  onNewClient: (name: string) => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = clients.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = clients.some(
    (c) => c.company_name.toLowerCase() === search.toLowerCase()
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        className="h-9 bg-transparent border-surface-border text-xs"
        style={{ color: colors.textPrimary }}
        value={open ? search : clientName || ""}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("", "");
        }}
        onFocus={() => {
          setOpen(true);
          setSearch(clientName || "");
        }}
        placeholder="Search or type new client name…"
      />
      {open && (search.length > 0 || filtered.length > 0) && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto"
          style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
        >
          {filtered.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity"
              style={{ color: colors.textPrimary, background: "none", border: "none", cursor: "pointer" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(String(c.id), c.company_name);
                setSearch(c.company_name);
                setOpen(false);
              }}
            >
              {c.company_name}
            </button>
          ))}
          {search.length >= 2 && !exactMatch && (
            <button
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{ color: colors.accent, background: "none", border: "none", cursor: "pointer", borderTop: `1px solid ${colors.border}` }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onNewClient(search);
                setOpen(false);
              }}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create new client "{search}"
            </button>
          )}
          {filtered.length === 0 && search.length < 2 && (
            <div className="px-3 py-2 text-xs" style={{ color: colors.textMuted }}>
              Type at least 2 characters…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SiteAddressCombobox({
  locations,
  value,
  onChange,
  colors,
}: {
  locations: { locationName: string; address: string; locationNo?: string }[];
  value: string;
  onChange: (address: string) => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = locations.filter((l) => {
    const q = search.toLowerCase();
    return l.address.toLowerCase().includes(q) || l.locationName.toLowerCase().includes(q);
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        className="h-9 bg-transparent border-surface-border text-xs"
        style={{ color: colors.textPrimary }}
        value={open ? search : value || ""}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          setIsNew(true);
          onChange(e.target.value);
        }}
        onFocus={() => {
          setOpen(true);
          setSearch(value || "");
        }}
        placeholder="Search existing or type new address…"
      />
      {open && (search.length > 0 || locations.length > 0) && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto"
          style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
        >
          {filtered.map((l, i) => (
            <button
              key={`${l.address}-${i}`}
              className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity"
              style={{ color: colors.textPrimary, background: "none", border: "none", cursor: "pointer" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(l.address);
                setSearch(l.address);
                setIsNew(false);
                setOpen(false);
              }}
            >
              <span className="font-medium">{l.locationName}</span>
              {l.address && <span className="ml-1.5 opacity-60">— {l.address}</span>}
            </button>
          ))}
          {search.length >= 3 && !filtered.some((l) => l.address.toLowerCase() === search.toLowerCase()) && (
            <button
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{ color: colors.accent, background: "none", border: "none", cursor: "pointer", borderTop: `1px solid ${colors.border}` }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(search);
                setIsNew(true);
                setOpen(false);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Use new address "{search}"
            </button>
          )}
          {filtered.length === 0 && search.length < 3 && (
            <div className="px-3 py-2 text-xs" style={{ color: colors.textMuted }}>
              Type to search locations…
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const { data: knownLocations = [] } = useLocations(dateStr);
  const createOrder = useCreateOrder();
  const optimise = useOptimise();
  const reorderStops = useReorderStops();
  const deleteOrder = useDeleteOrder();
  const createClient = useCreateClient();
  const { isPlanning, planningProgress, startPolling } = usePlanningStatus();

  // Form state
  const [formClient, setFormClient] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formSite, setFormSite] = useState("");
  const [formLitres, setFormLitres] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [formTimeFrom, setFormTimeFrom] = useState("");
  const [formTimeTo, setFormTimeTo] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [isNewClient, setIsNewClient] = useState(false);

  const stops = useMemo(() => {
    const routes = schedule?.routes ?? [];

    return routes
      .flatMap((route: any) =>
        (route.stops || []).map((s: any) => ({
          orderNo: s.orderNo,
          stopId: s.id || "",
          clientName: s.locationName || s.orderNo || "Stop",
          address: s.address || "",
          litres: s.duration || 0,
          status: (s.status?.toLowerCase() || "scheduled") as StopStatus,
        }))
      )
      .map((stop, index) => ({
        ...stop,
        seq: index + 1,
      }));
  }, [schedule]);

  const totalStops = stops.length;
  const completedStops = stops.filter((s: any) => s.status === "completed").length;
  const remainingStops = totalStops - completedStops;

  const resetForm = () => {
    setShowForm(false);
    setFormClient("");
    setFormClientName("");
    setFormSite("");
    setFormLitres("");
    setFormPriority("medium");
    setFormTimeFrom("");
    setFormTimeTo("");
    setFormNotes("");
    setFormContactEmail("");
    setFormContactPhone("");
    setIsNewClient(false);
  };

  const submitOrder = (clientName: string) => {
    const estimatedLitres = formLitres ? parseInt(formLitres, 10) : undefined;

    createOrder.mutate(
      {
        orderNo: `PACC-${Date.now()}`,
        date: dateStr,
        location: {
          name: clientName,
          address: formSite,
        },
        duration: 30,
        load1: estimatedLitres,
        priority: formPriority,
        twFrom: formTimeFrom || undefined,
        twTo: formTimeTo || undefined,
        notes: formNotes || undefined,
      },
      {
        onSuccess: (data) => {
          toast.success("Order added — optimising route…");
          resetForm();
          const planningId = data?.planning?.planningId;
          if (planningId) {
            startPolling(planningId);
          }
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleCreateOrder = () => {
    if (!formClientName || !formSite) {
      toast.error("Client and site address are required");
      return;
    }

    if (isNewClient) {
      // Create client first, then create the OptimoRoute order
      createClient.mutate(
        { company_name: formClientName, contact_email: formContactEmail || undefined, contact_phone: formContactPhone || undefined },
        {
          onSuccess: (newClient) => {
            toast.success(`New client "${newClient.company_name}" created`);
            submitOrder(newClient.company_name);
          },
          onError: (err) => toast.error(`Failed to create client: ${err.message}`),
        }
      );
    } else {
      submitOrder(formClientName);
    }
  };

  const handleNewClient = (name: string) => {
    setFormClientName(name);
    setFormClient("");
    setIsNewClient(true);
  };

  const handleSelectClient = (clientId: string, clientName: string) => {
    setFormClient(clientId);
    setFormClientName(clientName);
    setIsNewClient(false);
    setFormContactEmail("");
  };

  const handleOptimise = () => {
    optimise.mutate(dateStr, {
      onSuccess: (data) => {
        toast.success("Route optimisation triggered");
        const planningId = data?.planningId;
        if (planningId) {
          startPolling(planningId);
        }
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleReorder = (reordered: typeof stops) => {
    const orders = reordered.map((s) => ({
      orderNo: s.orderNo,
    }));
    reorderStops.mutate(orders, {
      onSuccess: (data: any) => {
        toast.success("Stops reordered — re-optimising route…");
        const planningId = data?.planning?.planningId;
        if (planningId) {
          startPolling(planningId);
        }
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const { getDragProps, getItemStyle } = useDragReorder({
    items: stops,
    onReorder: handleReorder,
    canDrag: (item: any) => item.status !== "completed",
  });

  const handleDelete = (orderNo: string, stopId?: string) => {
    toast.loading("Removing stop…", { id: `delete-${orderNo}` });
    deleteOrder.mutate({ orderNos: [orderNo], ids: stopId ? [stopId] : undefined }, {
      onSuccess: () => {
        toast.success("Stop removed", { id: `delete-${orderNo}` });
      },
      onError: (err) => {
        toast.error(err.message, { id: `delete-${orderNo}` });
      },
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
            disabled={optimise.isPending || isPlanning}
          >
            {isPlanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {optimise.isPending ? "Optimising…" : isPlanning ? `Planning ${planningProgress}%` : "Optimise Route"}
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

      {/* Route Analytics */}
      <DispatchAnalytics selectedDate={date} />


      {isPlanning && (
        <div
          className="flex items-center gap-3 p-3 sm:p-4"
          style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12 }}
        >
          <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: tc.accent }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium mb-1.5" style={{ color: tc.textPrimary }}>
              OptimoRoute is calculating the optimal route…
            </div>
            <div className="w-full rounded-full overflow-hidden h-1.5" style={{ background: `${tc.border}` }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${planningProgress}%`, background: tc.accent }}
              />
            </div>
          </div>
          <span className="text-xs font-bold shrink-0" style={{ color: tc.accent }}>
            {planningProgress}%
          </span>
        </div>
      )}

      {/* New Order form */}
      {showForm && (
        <div
          className="p-4 sm:p-5"
          style={{ background: tc.surface, border: `1px solid ${tc.border}`, borderRadius: 12 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: tc.textPrimary }}>New Delivery Order</span>
              {isNewClient && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: `${tc.accent}22`, color: tc.accent }}
                >
                  New Client
                </span>
              )}
            </div>
            <button onClick={resetForm} style={{ color: tc.textMuted, background: "none", border: "none", cursor: "pointer" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Client</label>
              <ClientCombobox
                clients={clients}
                value={formClient}
                clientName={formClientName}
                onChange={handleSelectClient}
                onNewClient={handleNewClient}
                colors={tc}
              />
            </div>
            {isNewClient && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Contact Email (optional)</label>
                  <Input
                    type="email"
                    className="h-9 bg-transparent border-surface-border text-xs"
                    style={{ color: tc.textPrimary }}
                    value={formContactEmail}
                    onChange={(e) => setFormContactEmail(e.target.value)}
                    placeholder="client@company.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Contact Phone (optional)</label>
                  <Input
                    type="tel"
                    className="h-9 bg-transparent border-surface-border text-xs"
                    style={{ color: tc.textPrimary }}
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    placeholder="04XX XXX XXX"
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: tc.textSecondary }}>Site Address</label>
              <SiteAddressCombobox
                locations={knownLocations}
                value={formSite}
                onChange={setFormSite}
                colors={tc}
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
              disabled={createOrder.isPending || createClient.isPending}
            >
              {createClient.isPending ? "Creating client…" : createOrder.isPending ? "Adding…" : isNewClient ? "Create Client & Add Order" : "Add to Schedule"}
            </Button>
            <Button
              variant="outline"
              className="h-8 text-xs"
              style={{ color: tc.textSecondary, borderColor: tc.border }}
              onClick={resetForm}
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
                        className="p-1 rounded transition-colors hover:bg-accent/10"
                        style={{ color: tc.accent, background: "none", border: "none", cursor: "pointer" }}
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
