import { useEffect, useRef, useState } from "react";
import { MapPin, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const STORAGE_KEY = "pacc.driver.share_location";
const PING_INTERVAL_MS = 30_000;

export function ShareLocationToggle() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const userIdRef = useRef<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
      setUid(data.user?.id ?? null);
    });
  }, []);

  // Are there scheduled stops for this driver today? If yes and tracking is off, nag.
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: todayStopCount = 0 } = useQuery({
    queryKey: ["driver-today-stop-count", uid, today],
    enabled: !!uid,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("dispatch_stops")
        .select("id", { count: "exact", head: true })
        .eq("driver_user_id", uid!)
        .eq("scheduled_date", today)
        .neq("status", "cancelled");
      return count ?? 0;
    },
  });
  const shouldNag = !enabled && todayStopCount > 0;

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!("geolocation" in navigator)) {
      toast.error("Location not supported on this device");
      setEnabled(false);
      return;
    }

    const sendPing = async (lat: number, lng: number, accuracy?: number, speed?: number | null, heading?: number | null) => {
      const uid = userIdRef.current;
      if (!uid) return;
      const now = Date.now();
      if (now - lastSentRef.current < PING_INTERVAL_MS) return;
      lastSentRef.current = now;
      const { error } = await supabase.from("driver_locations").insert({
        driver_user_id: uid,
        latitude: lat,
        longitude: lng,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
      });
      if (!error) setLastPing(new Date());
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        sendPing(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed, pos.coords.heading);
      },
      (err) => {
        toast.error(err.message || "Could not access location");
        setEnabled(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  const handleToggle = (checked: boolean) => {
    localStorage.setItem(STORAGE_KEY, checked ? "1" : "0");
    setEnabled(checked);
    if (checked) toast.success("Sharing your location with the team");
  };

  return (
    <div className="flex flex-col gap-2">
      {shouldNag && (
        <div
          className="card p-3 flex items-center gap-3"
          style={{ borderColor: "#f04a1a", background: "rgba(240,74,26,0.08)" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#f04a1a" }} />
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              You have {todayStopCount} stop{todayStopCount === 1 ? "" : "s"} today
            </div>
            <div className="text-xs text-muted-foreground">
              Turn on location so admin can review your route and dwell times.
            </div>
          </div>
          <button
            onClick={() => handleToggle(true)}
            className="text-xs font-semibold px-3 py-2 rounded-md"
            style={{ background: "#f04a1a", color: "#fff", minHeight: 44 }}
          >
            Start now
          </button>
        </div>
      )}
      <div className="card p-4 flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{
          background: enabled ? "var(--accent, #C8F26A)" : "var(--surface, #142A16)",
          border: "1px solid var(--surface-border)",
        }}
      >
        <MapPin className="w-4 h-4" style={{ color: enabled ? "#fff" : "var(--text-muted)" }} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">Share my location</div>
        <div className="text-xs text-muted-foreground">
          {enabled
            ? lastPing
              ? `Updated ${lastPing.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Waiting for first GPS fix…"
            : "Lets admin and customers see the truck"}
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>
    </div>
  );
}