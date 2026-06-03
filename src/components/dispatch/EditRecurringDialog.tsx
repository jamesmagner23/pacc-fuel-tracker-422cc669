import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrucks } from "@/hooks/useTrucks";
import { useUpsertRecurring, type DispatchRecurring } from "@/hooks/useDispatch";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recurring: DispatchRecurring | null;
}

const WEEKDAYS = [
  { v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" },
  { v: 4, l: "Thu" }, { v: 5, l: "Fri" }, { v: 6, l: "Sat" }, { v: 0, l: "Sun" },
];

export function EditRecurringDialog({ open, onOpenChange, recurring }: Props) {
  const { data: trucks = [] } = useTrucks();
  const upsert = useUpsertRecurring();

  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [truckId, setTruckId] = useState<string>("none");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "weekdays">("weekly");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    if (open && recurring) {
      setSiteName(recurring.site_name || "");
      setAddress(recurring.address || "");
      setNotes(recurring.notes || "");
      setTruckId(recurring.truck_id || "none");
      setFrequency(recurring.frequency);
      setWeekdays(recurring.weekdays || []);
      setEndDate(recurring.end_date || "");
    }
  }, [open, recurring]);

  const toggleDay = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const handleSave = async () => {
    if (!recurring) return;
    if (!siteName) {
      toast.error("Site name is required");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: recurring.id,
        client_account_id: recurring.client_account_id,
        site_name: siteName,
        address: address || null,
        notes: notes || null,
        truck_id: truckId === "none" ? null : truckId,
        frequency,
        weekdays: frequency === "weekly" ? weekdays : [],
        end_date: endDate || null,
        is_active: true,
      } as any);
      toast.success("Recurring order updated");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit recurring order</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Site name</Label>
            <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
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
            <Label className="text-xs">Frequency</Label>
            <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekdays">Weekdays only (Mon–Fri)</SelectItem>
                <SelectItem value="weekly">Specific weekdays</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <div>
            <Label className="text-xs">End date (optional)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">Leave blank for no end date.</p>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}