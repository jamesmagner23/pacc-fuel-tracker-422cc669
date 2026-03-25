import { useMemo, useState, useRef, useEffect } from "react";
import { TruckMap } from "@/components/TruckMap";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { LogOut, Droplets, MapPin, TrendingUp, Camera, Upload, X, Check } from "lucide-react";
import { PACCLogo } from "@/components/PACCLogo";
import { toast } from "sonner";
import { logActivity } from "@/hooks/useActivityLog";

function IntakeLogRow({ log }: { log: any }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (log.photo_path) {
      supabase.storage.from("bowser-photos").createSignedUrl(log.photo_path, 3600).then(({ data }) => {
        if (data?.signedUrl) setPhotoUrl(data.signedUrl);
      });
    }
  }, [log.photo_path]);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
      {photoUrl && (
        <img src={photoUrl} alt="Bowser" className="w-10 h-10 rounded object-cover border border-surface-border" />
      )}
      <div className="flex-1">
        <span className="text-sm font-semibold text-foreground">{Number(log.litres_entered).toLocaleString()}L</span>
        {log.notes && <span className="text-xs text-muted-foreground ml-2">{log.notes}</span>}
      </div>
      <span className="text-xs text-muted-foreground">
        {log.created_at ? format(new Date(log.created_at), "HH:mm") : ""}
      </span>
    </div>
  );
}


  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const lastWeekStart = format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const todayQuery = useQuery({
    queryKey: ["driver-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("date", today)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const weekQuery = useQuery({
    queryKey: ["driver-week", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", weekStart)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const lastWeekQuery = useQuery({
    queryKey: ["driver-lastweek", lastWeekStart, weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", lastWeekStart)
        .lt("date", weekStart);
      if (error) throw error;
      return data || [];
    },
  });

  return { todayQuery, weekQuery, lastWeekQuery };
}

function FuelIntakeForm() {
  const [litres, setLitres] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [bowserPrice, setBowserPrice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const todayLogs = useQuery({
    queryKey: ["fuel-intake-today"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("fuel_intake_logs")
        .select("*")
        .eq("driver_user_id", user.id)
        .eq("log_date", format(new Date(), "yyyy-MM-dd"))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      let photoPath: string | null = null;

      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("bowser-photos")
          .upload(fileName, photo, { contentType: photo.type });
        if (uploadErr) throw uploadErr;
        photoPath = fileName;
      }

      const { error } = await supabase.from("fuel_intake_logs").insert({
        driver_user_id: user.id,
        litres_entered: parseFloat(litres),
        photo_path: photoPath,
        bowser_retail_price: bowserPrice ? parseFloat(bowserPrice) : null,
        notes: notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fuel intake logged!");
      logActivity("fuel_intake", { litres: parseFloat(litres) || 0 });
      setLitres("");
      setPhoto(null);
      setPreview(null);
      setNotes("");
      setBowserPrice("");
      queryClient.invalidateQueries({ queryKey: ["fuel-intake-today"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to log intake");
    },
  });

  const todayTotal = (todayLogs.data || []).reduce((s, l: any) => s + (l.litres_entered || 0), 0);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Camera className="w-4 h-4 text-accent" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fuel Intake Log</span>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Photograph the bowser meter when filling up and enter the litres. This verifies buy vs sell accuracy.
      </p>

      {/* Photo upload area */}
      <div className="mb-4">
        {preview ? (
          <div className="relative rounded-lg overflow-hidden border border-surface-border">
            <img src={preview} alt="Bowser reading" className="w-full h-48 object-cover" />
            <button
              onClick={() => { setPhoto(null); setPreview(null); }}
              className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-foreground hover:bg-background transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-surface-border rounded-lg py-8 flex flex-col items-center gap-2 hover:border-accent/50 transition-colors bg-transparent"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tap to take photo or upload</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          className="hidden"
        />
      </div>

      {/* Litres input */}
      <div className="flex flex-col gap-1.5 mb-3">
        <label className="text-xs text-muted-foreground">Litres from bowser</label>
        <input
          type="number"
          value={litres}
          onChange={(e) => setLitres(e.target.value)}
          placeholder="e.g. 3500"
          className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Price on bowser */}
      <div className="flex flex-col gap-1.5 mb-3">
        <label className="text-xs text-muted-foreground">Price shown on bowser ($/L)</label>
        <input
          type="number"
          step="0.0001"
          value={bowserPrice}
          onChange={(e) => setBowserPrice(e.target.value)}
          placeholder="e.g. 1.8500"
          className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5 mb-4">
        <label className="text-xs text-muted-foreground">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Pacific Dandenong"
          className="bg-surface border border-surface-border rounded-lg text-foreground px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
      </div>

      <button
        onClick={() => submitMutation.mutate()}
        disabled={!litres || submitMutation.isPending}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        {submitMutation.isPending ? "Submitting…" : "Log Fuel Intake"}
      </button>

      {/* Today's intake logs */}
      {(todayLogs.data || []).length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Today's Intake Logs</p>
          {(todayLogs.data || []).map((log: any) => (
              <IntakeLogRow key={log.id} log={log} />
            ))}
          
          <div className="flex justify-between mt-2 pt-2 border-t border-surface-border">
            <span className="text-xs font-medium text-muted-foreground">Total Intake</span>
            <span className="text-sm font-bold text-foreground">{todayTotal.toLocaleString()}L</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DriverPortal() {
  const { todayQuery, weekQuery, lastWeekQuery } = useDriverTransactions();

  useEffect(() => {
    logActivity("page_view", { page: "driver_portal" });
  }, []);

  const today = todayQuery.data || [];
  const week = weekQuery.data || [];
  const lastWeek = lastWeekQuery.data || [];

  const todayLitres = today.reduce((s, t) => s + (t.cantidad || 0), 0);
  const todayDeliveries = today.length;
  const weekLitres = week.reduce((s, t) => s + (t.cantidad || 0), 0);
  const lastWeekLitres = lastWeek.reduce((s, t) => s + (t.cantidad || 0), 0);
  const weekChange = lastWeekLitres > 0 ? ((weekLitres - lastWeekLitres) / lastWeekLitres) * 100 : 0;

  const todaySites = useMemo(() => {
    const seen = new Set<string>();
    return today
      .filter((t) => t.nombre_cliente1 && !seen.has(t.nombre_cliente1) && seen.add(t.nombre_cliente1))
      .map((t) => t.nombre_cliente1);
  }, [today]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <PACCLogo size="sm" />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Stephan</span>
          <button
            onClick={handleSignOut}
            className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-[520px] mx-auto flex flex-col gap-4">
        {/* Date */}
        <div className="text-xs text-muted-foreground tracking-wider uppercase">
          {format(new Date(), "EEEE dd MMMM yyyy")}
        </div>

        <TruckMap height={200} compact={true} />

        <div className="card p-7 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <Droplets className="w-3.5 h-3.5 text-accent" />
            <span className="kpi-label">Litres Delivered Today</span>
          </div>

          <div className="kpi-value text-[56px]" style={{ color: todayLitres > 0 ? undefined : "var(--text-muted)" }}>
            {todayLitres > 0
              ? todayLitres >= 1000
                ? `${(todayLitres / 1000).toFixed(2)}k`
                : todayLitres.toFixed(0)
              : "—"
            }
            <span className="text-2xl font-normal text-muted-foreground ml-1">L</span>
          </div>

          {todayLitres > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              {todayDeliveries} {todayDeliveries === 1 ? "delivery" : "deliveries"} · {todaySites.length} {todaySites.length === 1 ? "site" : "sites"}
            </div>
          )}
          {todayLitres === 0 && (
            <p className="text-xs text-muted-foreground mt-2 m-0">No deliveries recorded yet today</p>
          )}
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-5">
            <p className="kpi-label mb-1.5">This Week</p>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {weekLitres >= 1000 ? `${(weekLitres / 1000).toFixed(1)}k` : weekLitres.toFixed(0)}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">L</span>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <TrendingUp className="w-3 h-3" style={{ color: weekChange >= 0 ? "var(--positive)" : "var(--negative)" }} />
              <span className="text-xs" style={{ color: weekChange >= 0 ? "var(--positive)" : "var(--negative)" }}>
                {weekChange >= 0 ? "+" : ""}{weekChange.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="card p-5">
            <p className="kpi-label mb-1.5">Today's Sites</p>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {todaySites.length}
            </div>
            {todaySites.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1.5 truncate">
                {todaySites.slice(0, 2).join(", ")}
                {todaySites.length > 2 && ` +${todaySites.length - 2}`}
              </div>
            )}
          </div>
        </div>

        {/* Fuel Intake Log */}
        <FuelIntakeForm />

        {/* Today's delivery log */}
        {today.length > 0 && (
          <div className="card" style={{ padding: 0 }}>
            <div className="px-5 py-3.5 border-b border-surface-border">
              <span className="text-sm font-semibold text-foreground">Today's Deliveries</span>
            </div>
            <div className="flex flex-col">
              {today.map((t, i) => (
                <div
                  key={t.id}
                  className="data-row flex items-center justify-between px-5 py-2.5"
                  style={{ borderBottom: i < today.length - 1 ? undefined : "none" }}
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {t.nombre_cliente1 || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.fecha ? format(new Date(t.fecha), "HH:mm") : "—"}
                        {t.factura ? ` · #${t.factura}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-md font-semibold text-accent tabular-nums">
                    {(t.cantidad || 0).toLocaleString()}L
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between px-5 py-3 border-t border-surface-border bg-accent-light">
              <span className="text-sm font-semibold text-muted-foreground">Total</span>
              <span className="text-md font-bold text-foreground tabular-nums">
                {todayLitres.toLocaleString()}L
              </span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {today.length === 0 && !todayQuery.isLoading && (
          <div className="text-center py-10">
            <Droplets className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-md text-muted-foreground m-0">No deliveries yet today</p>
            <p className="text-xs text-muted-foreground mt-1.5">Data updates every minute</p>
          </div>
        )}

        {todayQuery.isLoading && (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}
