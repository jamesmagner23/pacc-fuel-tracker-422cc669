import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ScheduledForm {
  client_account_id: string;
  site_name: string;
  scheduled_date: Date | undefined;
  estimated_litres: string;
  notes: string;
}

const emptyForm: ScheduledForm = {
  client_account_id: "",
  site_name: "",
  scheduled_date: undefined,
  estimated_litres: "",
  notes: "",
};

export default function ScheduledTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ScheduledForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["scheduled-deliveries-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_deliveries")
        .select("*, client_accounts(company_name)")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      client_account_id: number;
      site_name: string;
      scheduled_date: string;
      estimated_litres: number | null;
      notes: string | null;
    }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase
          .from("scheduled_deliveries")
          .update(rest)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { id, ...rest } = payload;
        const { error } = await supabase
          .from("scheduled_deliveries")
          .insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-deliveries-admin"] });
      setForm(emptyForm);
      setEditingId(null);
      toast.success(editingId ? "Delivery updated" : "Delivery scheduled");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_deliveries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-deliveries-admin"] });
      toast.success("Delivery deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_account_id || !form.site_name || !form.scheduled_date) {
      toast.error("Please fill in client, site name, and date");
      return;
    }
    upsertMutation.mutate({
      ...(editingId ? { id: editingId } : {}),
      client_account_id: Number(form.client_account_id),
      site_name: form.site_name,
      scheduled_date: format(form.scheduled_date, "yyyy-MM-dd"),
      estimated_litres: form.estimated_litres ? Number(form.estimated_litres) : null,
      notes: form.notes || null,
    });
  };

  const handleEdit = (d: any) => {
    setEditingId(d.id);
    setForm({
      client_account_id: String(d.client_account_id),
      site_name: d.site_name,
      scheduled_date: parseISO(d.scheduled_date),
      estimated_litres: d.estimated_litres ? String(d.estimated_litres) : "",
      notes: d.notes || "",
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const statusColor = (s: string) => {
    if (s === "completed") return "default";
    if (s === "cancelled") return "destructive";
    return "secondary";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {editingId ? "Edit Scheduled Delivery" : "Schedule New Delivery"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Client</label>
              <Select
                value={form.client_account_id}
                onValueChange={(v) => setForm((f) => ({ ...f, client_account_id: v }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select client" />
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

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Site Name</label>
              <Input
                value={form.site_name}
                onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
                placeholder="e.g. Depot A"
                className="text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Scheduled Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal text-sm",
                      !form.scheduled_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.scheduled_date
                      ? format(form.scheduled_date, "PPP")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.scheduled_date}
                    onSelect={(d) => setForm((f) => ({ ...f, scheduled_date: d }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Estimated Litres</label>
              <Input
                type="number"
                value={form.estimated_litres}
                onChange={(e) => setForm((f) => ({ ...f, estimated_litres: e.target.value }))}
                placeholder="e.g. 5000"
                className="text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Notes (optional)</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any delivery notes…"
                className="text-sm min-h-[60px]"
              />
            </div>

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={upsertMutation.isPending}>
                <Plus className="h-4 w-4 mr-1" />
                {editingId ? "Update" : "Schedule"}
              </Button>
              {editingId && (
                <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Scheduled Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled deliveries yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {deliveries.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {d.client_accounts?.company_name || "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm truncate">{d.site_name}</span>
                      <Badge variant={statusColor(d.status || "scheduled")} className="text-[10px]">
                        {d.status || "scheduled"}
                      </Badge>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{format(parseISO(d.scheduled_date), "EEE dd MMM yyyy")}</span>
                      {d.estimated_litres && <span>{Number(d.estimated_litres).toLocaleString()}L</span>}
                      {d.notes && <span className="truncate max-w-[200px]">{d.notes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleEdit(d)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
