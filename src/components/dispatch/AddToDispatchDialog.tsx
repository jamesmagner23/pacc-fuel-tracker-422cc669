import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTrucks } from "@/hooks/useTrucks";
import { useUpsertStop, useUpsertRecurring } from "@/hooks/useDispatch";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientAccountId: number;
  clientName?: string;
  projectId?: string | null;
  defaultSiteName?: string;
  defaultAddress?: string;
}

const WEEKDAYS = [
  { v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" },
  { v: 4, l: "Thu" }, { v: 5, l: "Fri" }, { v: 6, l: "Sat" }, { v: 0, l: "Sun" },
];

export function AddToDispatchDialog({
  open, onOpenChange, clientAccountId, clientName, projectId, defaultSiteName, defaultAddress,
}: Props) {
  const { data: trucks = [] } = useTrucks();
  const upsertStop = useUpsertStop();
  const upsertRecurring = useUpsertRecurring();

  const [date, setDate] = useState<Date>(addDays(new Date(), 1));
  const [siteName, setSiteName] = useState(defaultSiteName || clientName || "");
  const [address, setAddress] = useState(defaultAddress || "");
  const [litres, setLitres] = useState("");
  const [truckId, setTruckId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "weekdays">("weekly");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (open) {
      setSiteName(defaultSiteName || clientName || "");
      setAddress(defaultAddress || "");
      setLitres("");
      setNotes("");
      setRecurring(false);
      setTruckId("none");
    }
  }, [open, defaultSiteName, defaultAddress, clientName]);

  const handleSubmit = async () => {
    if (!siteName) {
      toast.error("Site name is required");
      return;
    }
    try {
      let recurringId: string | null = null;
      if (recurring) {
        const r = await upsertRecurring.mutateAsync({
          client_account_id: clientAccountId,
          project_id: projectId ?? null,
          truck_id: truckId === "none" ? null : truckId,
          site_name: siteName,
          address: address || null,
          estimated_litres: litres ? Number(litres) : null,
          notes: notes || null,
          frequency,
          weekdays: frequency === "weekly" ? weekdays : [],
          start_date: format(date, "yyyy-MM-dd"),
          is_active: true,
        });
        recurringId = (r as any).id;
      }

      await upsertStop.mutateAsync({
        scheduled_date: format(date, "yyyy-MM-dd"),
        client_account_id: clientAccountId,
        project_id: projectId ?? null,
        truck_id: truckId === "none" ? null : truckId,
        site_name: siteName,
        address: address || null,
        estimated_litres: litres ? Number(litres) : null,
        notes: notes || null,
        sequence: 9999,
        status: "scheduled",
        recurring_id: recurringId,
      });

      toast.success(recurring ? "Stop added — recurring template saved" : "Added to dispatch");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add stop");
    }
  };

  const toggleDay = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Dispatch</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Site name</Label>
            <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="e.g. Alphington" />
          </div>
          <div>
            <Label className="text-xs">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Smith St, Melbourne" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start font-normal">
                    <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                    {format(date, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Estimated litres</Label>
              <Input type="number" value={litres} onChange={(e) => setLitres(e.target.value)} placeholder="3000" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Assign truck</Label>
            <Select value={truckId} onValueChange={setTruckId}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {trucks.filter((t) => t.is_active).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access via rear gate…" />
          </div>

          <div className="border-t border-border pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={recurring} onCheckedChange={(v) => setRecurring(!!v)} />
              <span className="text-sm">Recurring order</span>
            </label>
            {recurring && (
              <div className="mt-2 space-y-2 pl-6">
                <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekdays">Weekdays only (Mon–Fri)</SelectItem>
                    <SelectItem value="weekly">Specific weekdays</SelectItem>
                  </SelectContent>
                </Select>
                {frequency === "weekly" && (
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => toggleDay(d.v)}
                        className={`px-2 py-1 text-xs rounded border ${
                          weekdays.includes(d.v)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Saves a template plus the first stop. Future occurrences populate as they're approved.
                </p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={upsertStop.isPending}>
            {upsertStop.isPending ? "Adding…" : "Add to dispatch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
