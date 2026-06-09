import { useMemo, useState } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, GripVertical, Fuel, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDispatchStopsRange, useMoveStop, type DispatchStop } from "@/hooks/useDispatch";
import { useTrucks } from "@/hooks/useTrucks";
import { LogStopsDialog } from "./LogStopsDialog";

// Threshold below which a day is considered to have "spare capacity"
// for slotting in an additional bulk fuel drop.
const LIGHT_DAY_STOP_THRESHOLD = 3;

function useClientList() {
  return useQuery({
    queryKey: ["client-accounts-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_accounts")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name");
      return (data || []) as { id: number; company_name: string }[];
    },
  });
}

export function WeekViewTab() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState<Date | undefined>(undefined);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: stops = [], isLoading } = useDispatchStopsRange(startStr, endStr);
  const { data: trucks = [] } = useTrucks();
  const { data: clients = [] } = useClientList();
  const move = useMoveStop();

  const clientNameById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.company_name])),
    [clients]
  );
  const truckNameById = useMemo(
    () => Object.fromEntries(trucks.map((t) => [t.id, t.name])),
    [trucks]
  );

  const stopsByDay = useMemo(() => {
    const map: Record<string, DispatchStop[]> = {};
    for (const d of days) map[format(d, "yyyy-MM-dd")] = [];
    for (const s of stops) {
      if (map[s.scheduled_date]) map[s.scheduled_date].push(s);
    }
    return map;
  }, [stops, days]);

  const litresByDay = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, list] of Object.entries(stopsByDay)) {
      out[k] = list.reduce((sum, s) => sum + (s.estimated_litres || 0), 0);
    }
    return out;
  }, [stopsByDay]);

  const handleDrop = (dayStr: string) => {
    if (!dragId) return;
    const stop = stops.find((s) => s.id === dragId);
    setDragId(null);
    setOverDay(null);
    if (!stop || stop.scheduled_date === dayStr) return;
    const target = stopsByDay[dayStr] || [];
    const newSeq = (target[target.length - 1]?.sequence ?? 0) + 10;
    move.mutate(
      { id: stop.id, scheduled_date: dayStr, sequence: newSeq },
      {
        onSuccess: () => toast.success(`Moved to ${format(new Date(dayStr), "EEE dd MMM")}`),
        onError: (e: any) => toast.error(e.message ?? "Failed to move stop"),
      }
    );
  };

  const openLogFor = (d: Date) => {
    setLogDate(d);
    setLogOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Weekly Plan</h2>
          <p className="text-[11px] text-muted-foreground">
            Drag stops between days · spot light days for bulk fuel drops
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            This week
          </Button>
          <div className="text-xs font-medium px-2 min-w-[160px] text-center">
            {format(weekStart, "dd MMM")} – {format(addDays(weekStart, 6), "dd MMM yyyy")}
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2">
        {days.map((d) => {
          const dayStr = format(d, "yyyy-MM-dd");
          const dayStops = stopsByDay[dayStr] || [];
          const activeCount = dayStops.filter(
            (s) => s.status !== "completed" && s.status !== "cancelled"
          ).length;
          const litres = litresByDay[dayStr] || 0;
          const isLight = activeCount < LIGHT_DAY_STOP_THRESHOLD;
          const isOver = overDay === dayStr;

          return (
            <div
              key={dayStr}
              onDragOver={(e) => {
                e.preventDefault();
                setOverDay(dayStr);
              }}
              onDragLeave={() => {
                if (overDay === dayStr) setOverDay(null);
              }}
              onDrop={() => handleDrop(dayStr)}
              className={cn(
                "card p-2 flex flex-col gap-2 min-h-[260px] transition-colors",
                isOver && "ring-2 ring-accent",
                isToday(d) && "border-accent/60"
              )}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(d, "EEE")}
                  </div>
                  <div className={cn("text-sm font-semibold", isToday(d) && "text-accent")}>
                    {format(d, "dd MMM")}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  title="Log stops for this day"
                  onClick={() => openLogFor(d)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Day stats */}
              <div className="flex items-center gap-1 px-1 flex-wrap">
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                  {activeCount} stop{activeCount === 1 ? "" : "s"}
                </Badge>
                {litres > 0 && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
                    <Fuel className="w-2.5 h-2.5" /> {litres.toLocaleString()}L
                  </Badge>
                )}
              </div>

              {/* Stops list */}
              <div className="flex flex-col gap-1.5 flex-1">
                {isLoading ? (
                  <div className="text-[10px] text-muted-foreground text-center py-4">…</div>
                ) : dayStops.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground text-center py-4 italic">
                    Drop a stop here
                  </div>
                ) : (
                  dayStops.map((s) => {
                    const isDone = s.status === "completed" || s.status === "cancelled";
                    return (
                      <div
                        key={s.id}
                        draggable={!isDone}
                        onDragStart={() => setDragId(s.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverDay(null);
                        }}
                        className={cn(
                          "p-2 rounded-md border border-border bg-card/50 text-[11px] flex gap-1.5 items-start",
                          !isDone && "cursor-grab active:cursor-grabbing hover:border-accent/50",
                          isDone && "opacity-50",
                          dragId === s.id && "opacity-40"
                        )}
                      >
                        {!isDone && (
                          <GripVertical className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{s.site_name}</div>
                          {clientNameById[s.client_account_id] && (
                            <div className="text-muted-foreground truncate text-[10px]">
                              {clientNameById[s.client_account_id]}
                            </div>
                          )}
                          <div className="flex gap-1.5 mt-0.5 text-[9px] text-muted-foreground">
                            {s.estimated_litres ? <span>{s.estimated_litres.toLocaleString()}L</span> : null}
                            {s.truck_id && truckNameById[s.truck_id] && <span>· {truckNameById[s.truck_id]}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Gap / opportunity hint */}
                {!isLoading && isLight && (
                  <button
                    onClick={() => openLogFor(d)}
                    className="mt-auto rounded-md border border-dashed border-accent/40 bg-accent/5 hover:bg-accent/10 text-accent text-[10px] px-2 py-1.5 flex items-center justify-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    Spare capacity — slot a bulk drop
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LogStopsDialog open={logOpen} onOpenChange={setLogOpen} defaultDate={logDate} />
    </div>
  );
}