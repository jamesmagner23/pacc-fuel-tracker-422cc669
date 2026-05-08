import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

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
  );
}