import { useState } from "react";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrucks } from "@/hooks/useTrucks";
import { useDrivers } from "@/hooks/useDrivers";
import { useUpsertStop } from "@/hooks/useDispatch";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: Date;
}

interface Row {
  key: string;
  client_account_id: number | null;
  site_name: string;
  address: string;
  litres: string;
  truck_id: string; // "none" or id
  driver_user_id: string; // "none" or id
}

function newRow(): Row {
  return {
    key: Math.random().toString(36).slice(2),
    client_account_id: null,
    site_name: "",
    address: "",
    litres: "",
    truck_id: "none",
    driver_user_id: "none",
  };
}

export function LogStopsDialog({ open, onOpenChange, defaultDate }: Props) {
  const [date, setDate] = useState<Date>(defaultDate ?? addDays(new Date(), 1));
  const [rows, setRows] = useState<Row[]>([newRow(), newRow(), newRow()]);
  const [bulkTruck, setBulkTruck] = useState<string>("none");
  const [bulkDriver, setBulkDriver] = useState<string>("none");

  const { data: trucks = [] } = useTrucks();
  const { data: drivers = [] } = useDrivers();
  const { data: clients = [] } = useQuery({
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
  const upsertStop = useUpsertStop();

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const applyBulk = () => {
    setRows((rs) => rs.map((r) => ({
      ...r,
      truck_id: bulkTruck !== "none" ? bulkTruck : r.truck_id,
      driver_user_id: bulkDriver !== "none" ? bulkDriver : r.driver_user_id,
    })));
    toast.success("Applied to all rows");
  };

  const save = async () => {
    const valid = rows.filter((r) => r.client_account_id && r.site_name.trim());
    if (!valid.length) {
      toast.error("Add at least one stop with a customer and site name.");
      return;
    }
    try {
      let i = 0;
      for (const r of valid) {
        await upsertStop.mutateAsync({
          scheduled_date: format(date, "yyyy-MM-dd"),
          client_account_id: r.client_account_id!,
          site_name: r.site_name.trim(),
          address: r.address || null,
          estimated_litres: r.litres ? Number(r.litres) : null,
          truck_id: r.truck_id !== "none" ? r.truck_id : null,
          driver_user_id: r.driver_user_id !== "none" ? r.driver_user_id : null,
          status: "scheduled",
          sequence: 1000 + i++,
        } as any);
      }
      toast.success(`${valid.length} stop${valid.length > 1 ? "s" : ""} logged`);
      setRows([newRow(), newRow(), newRow()]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to log stops");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Stops</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date + bulk assign */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[170px] justify-start font-normal">
                    <CalendarIcon className="w-3.5 h-3.5 mr-2" /> {format(date, "EEE dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1" />
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs">Bulk truck</Label>
                <Select value={bulkTruck} onValueChange={setBulkTruck}>
                  <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {trucks.filter((t) => t.is_active).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Bulk driver</Label>
                <Select value={bulkDriver} onValueChange={setBulkDriver}>
                  <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.user_id} value={d.user_id}>{d.full_name || d.email || d.user_id.slice(0, 6)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" onClick={applyBulk}>
                <Check className="w-3.5 h-3.5 mr-1" /> Apply to all
              </Button>
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {rows.map((r, idx) => {
              const client = clients.find((c) => c.id === r.client_account_id);
              return (
                <div key={r.key} className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg border border-border">
                  <div className="col-span-1 text-xs text-muted-foreground pt-2">#{idx + 1}</div>
                  <div className="col-span-4">
                    <Select
                      value={r.client_account_id ? String(r.client_account_id) : ""}
                      onValueChange={(v) => {
                        const c = clients.find((x) => x.id === Number(v));
                        update(r.key, {
                          client_account_id: Number(v),
                          site_name: r.site_name || c?.company_name || "",
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Customer…" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="mt-1 h-8 text-xs"
                      placeholder="Site / address"
                      value={r.address}
                      onChange={(e) => update(r.key, { address: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      className="h-9 text-xs"
                      placeholder="Site name"
                      value={r.site_name}
                      onChange={(e) => update(r.key, { site_name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      className="h-9 text-xs"
                      type="number"
                      placeholder="L"
                      value={r.litres}
                      onChange={(e) => update(r.key, { litres: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Select value={r.truck_id} onValueChange={(v) => update(r.key, { truck_id: v })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Truck" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {trucks.filter((t) => t.is_active).map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Select value={r.driver_user_id} onValueChange={(v) => update(r.key, { driver_user_id: v })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Driver" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {drivers.map((d) => (
                          <SelectItem key={d.user_id} value={d.user_id}>{d.full_name || d.email || d.user_id.slice(0, 6)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(r.key)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, newRow()])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add another stop
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={upsertStop.isPending}>
            {upsertStop.isPending ? "Saving…" : "Save stops"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}