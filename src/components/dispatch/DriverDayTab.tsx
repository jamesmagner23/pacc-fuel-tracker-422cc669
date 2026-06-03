import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Calendar as CalendarIcon, Clock, Gauge, MapPin, Route as RouteIcon, Timer, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDrivers } from "@/hooks/useDrivers";
import { useMapboxToken } from "@/hooks/useMapboxToken";

// ---------- helpers ----------
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const STOP_RADIUS_KM = 0.1; // 100 m cluster radius
const MIN_STOP_MINUTES = 3; // anything ≥ 3 min counted as a stop

interface Ping {
  lat: number;
  lng: number;
  t: number; // ms
  speed: number | null;
}

interface StopEvent {
  startMs: number;
  endMs: number;
  durationMin: number;
  centroid: { lat: number; lng: number };
  pingCount: number;
}

function detectStops(pings: Ping[]): StopEvent[] {
  if (pings.length < 2) return [];
  const stops: StopEvent[] = [];
  let cluster: Ping[] = [pings[0]];

  const flush = () => {
    const first = cluster[0];
    const last = cluster[cluster.length - 1];
    const durMin = (last.t - first.t) / 60000;
    if (durMin >= MIN_STOP_MINUTES) {
      const lat = cluster.reduce((a, p) => a + p.lat, 0) / cluster.length;
      const lng = cluster.reduce((a, p) => a + p.lng, 0) / cluster.length;
      stops.push({
        startMs: first.t,
        endMs: last.t,
        durationMin: durMin,
        centroid: { lat, lng },
        pingCount: cluster.length,
      });
    }
  };

  for (let i = 1; i < pings.length; i++) {
    const p = pings[i];
    const ref = cluster[0];
    if (haversineKm(ref, p) <= STOP_RADIUS_KM) {
      cluster.push(p);
    } else {
      flush();
      cluster = [p];
    }
  }
  flush();
  return stops;
}

function fmtHM(ms: number) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}
function fmtTime(ms: number) {
  return format(new Date(ms), "HH:mm");
}

// ---------- data hooks ----------
function useDriverPings(driverId: string | null, dateStr: string) {
  return useQuery({
    queryKey: ["driver-day-pings", driverId, dateStr],
    enabled: !!driverId,
    queryFn: async () => {
      const start = `${dateStr}T00:00:00`;
      const end = `${dateStr}T23:59:59`;
      const { data, error } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, recorded_at, speed")
        .eq("driver_user_id", driverId!)
        .gte("recorded_at", start)
        .lte("recorded_at", end)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        t: new Date(r.recorded_at).getTime(),
        speed: r.speed ?? null,
      })) as Ping[];
    },
  });
}

function useDriverStopsForDay(driverId: string | null, dateStr: string) {
  return useQuery({
    queryKey: ["driver-day-stops", driverId, dateStr],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_stops")
        .select("id, site_name, address, latitude, longitude, status, completed_at, delivered_litres, client_account_id, sequence")
        .eq("driver_user_id", driverId!)
        .eq("scheduled_date", dateStr)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

function useClientNameMap(ids: number[]) {
  return useQuery({
    queryKey: ["client-name-map", ids.sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("client_accounts").select("id, company_name").in("id", ids);
      const map: Record<number, string> = {};
      (data || []).forEach((c: any) => { map[c.id] = c.company_name; });
      return map;
    },
  });
}

// ---------- map ----------
function DriverDayMap({
  pings,
  stopEvents,
  height = 460,
}: { pings: Ping[]; stopEvents: StopEvent[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const { data: token } = useMapboxToken();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: pings[0] ? [pings[0].lng, pings[0].lat] : [144.9631, -37.8136],
      zoom: 10,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => setReady(true));
    return () => { map.remove(); mapRef.current = null; };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Clear previous layers
    if (map.getLayer("trail-line")) map.removeLayer("trail-line");
    if (map.getSource("trail")) map.removeSource("trail");

    // Add polyline
    if (pings.length >= 2) {
      map.addSource("trail", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: pings.map((p) => [p.lng, p.lat]) },
        },
      });
      map.addLayer({
        id: "trail-line",
        type: "line",
        source: "trail",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f04a1a", "line-width": 3, "line-opacity": 0.85 },
      });
    }

    // Markers (remove old DOM markers we added previously)
    document.querySelectorAll(".dd-stop-marker").forEach((el) => el.remove());
    stopEvents.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "dd-stop-marker";
      el.style.cssText = `
        width:26px;height:26px;border-radius:50%;
        background:#120a04;color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;
        border:2px solid #f04a1a;box-shadow:0 2px 6px rgba(0,0,0,0.35);
      `;
      el.textContent = String(i + 1);
      new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([s.centroid.lng, s.centroid.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
            `<div style="font-size:12px;font-weight:600;color:#120a04">Stop ${i + 1}</div>
             <div style="font-size:11px;color:#444">${fmtTime(s.startMs)} – ${fmtTime(s.endMs)}</div>
             <div style="font-size:11px;color:#444">Dwell ${fmtHM(s.endMs - s.startMs)}</div>`
          )
        )
        .addTo(map);
    });

    // Fit bounds
    if (pings.length > 0) {
      const b = new mapboxgl.LngLatBounds();
      pings.forEach((p) => b.extend([p.lng, p.lat]));
      try { map.fitBounds(b, { padding: 50, duration: 600, maxZoom: 14 }); } catch { /* noop */ }
    }
  }, [ready, pings, stopEvents]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: "100%",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid hsl(var(--border))",
      }}
    />
  );
}

// ---------- main ----------
export function DriverDayTab() {
  const [date, setDate] = useState<Date>(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);

  const dateStr = format(date, "yyyy-MM-dd");
  const { data: drivers = [] } = useDrivers();

  // Default to first driver
  useEffect(() => {
    if (!driverId && drivers.length > 0) setDriverId(drivers[0].user_id);
  }, [drivers, driverId]);

  const { data: pings = [], isLoading: pingsLoading } = useDriverPings(driverId, dateStr);
  const { data: stops = [] } = useDriverStopsForDay(driverId, dateStr);
  const clientIds = useMemo(() => Array.from(new Set(stops.map((s: any) => s.client_account_id).filter(Boolean))), [stops]);
  const { data: clientNames = {} } = useClientNameMap(clientIds as number[]);

  const stopEvents = useMemo(() => detectStops(pings), [pings]);

  // ----- metrics -----
  const metrics = useMemo(() => {
    if (pings.length < 2) {
      return { km: 0, shiftMs: 0, stoppedMs: 0, driveMs: 0, otMs: 0 };
    }
    let km = 0;
    for (let i = 1; i < pings.length; i++) km += haversineKm(pings[i - 1], pings[i]);
    const shiftMs = pings[pings.length - 1].t - pings[0].t;
    const stoppedMs = stopEvents.reduce((a, s) => a + (s.endMs - s.startMs), 0);
    const driveMs = Math.max(0, shiftMs - stoppedMs);
    const otMs = Math.max(0, shiftMs - 8 * 60 * 60 * 1000);
    return { km, shiftMs, stoppedMs, driveMs, otMs };
  }, [pings, stopEvents]);

  const totalLitres = useMemo(
    () => stops.reduce((a: number, s: any) => a + (Number(s.delivered_litres) || 0), 0),
    [stops]
  );

  // Match each stop event to nearest scheduled stop (by coords if available, else by completed_at)
  const matched = useMemo(() => {
    return stopEvents.map((ev) => {
      let best: any = null;
      let bestDist = Infinity;
      stops.forEach((s: any) => {
        if (s.latitude != null && s.longitude != null) {
          const d = haversineKm({ lat: Number(s.latitude), lng: Number(s.longitude) }, ev.centroid);
          if (d < 0.3 && d < bestDist) { bestDist = d; best = s; }
        } else if (s.completed_at) {
          const ct = new Date(s.completed_at).getTime();
          if (ct >= ev.startMs - 15 * 60000 && ct <= ev.endMs + 15 * 60000) {
            if (!best) best = s;
          }
        }
      });
      return { ev, stop: best };
    });
  }, [stopEvents, stops]);

  const medianDwell = useMemo(() => {
    if (stopEvents.length === 0) return 0;
    const sorted = [...stopEvents].map((s) => s.endMs - s.startMs).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [stopEvents]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Driver Day</h2>
          <p className="text-[11px] text-muted-foreground">GPS trail, stop-by-stop dwell time, and efficiency for a single driver-day</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={driverId ?? ""} onValueChange={(v) => setDriverId(v)}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Pick driver" /></SelectTrigger>
            <SelectContent>
              {drivers.map((d) => (
                <SelectItem key={d.user_id} value={d.user_id}>{d.full_name || d.email || d.user_id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" /> {format(date, "dd MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { label: "Shift", value: metrics.shiftMs ? fmtHM(metrics.shiftMs) : "—", icon: Clock },
          { label: "KM driven", value: metrics.km ? metrics.km.toFixed(1) : "—", icon: RouteIcon },
          { label: "Drive time", value: metrics.driveMs ? fmtHM(metrics.driveMs) : "—", icon: Gauge },
          { label: "Stopped", value: metrics.stoppedMs ? fmtHM(metrics.stoppedMs) : "—", icon: Timer },
          { label: "Stops", value: stopEvents.length, icon: MapPin },
          {
            label: "OT (>8h)",
            value: metrics.otMs ? fmtHM(metrics.otMs) : "0m",
            icon: AlertTriangle,
            warn: metrics.otMs > 0,
          },
        ].map((k: any) => (
          <div key={k.label} className="card p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</span>
              <k.icon className={`w-3.5 h-3.5 ${k.warn ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div className={`text-lg font-bold ${k.warn ? "text-destructive" : ""}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="card p-3">
        {pingsLoading ? (
          <div className="text-xs text-muted-foreground py-12 text-center">Loading trail…</div>
        ) : pings.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center">
            No GPS data for this driver on {format(date, "dd MMM yyyy")}.<br />
            Driver needs to turn on <strong>Share my location</strong> in the driver portal.
          </div>
        ) : (
          <DriverDayMap pings={pings} stopEvents={stopEvents} height={460} />
        )}
      </div>

      {/* Stop timeline */}
      {stopEvents.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Stop timeline</div>
              <div className="text-[11px] text-muted-foreground">
                {stopEvents.length} stops · {totalLitres.toLocaleString()} L delivered · median dwell {fmtHM(medianDwell)}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Location</th>
                  <th className="py-2 pr-2">Arrived</th>
                  <th className="py-2 pr-2">Left</th>
                  <th className="py-2 pr-2">Dwell</th>
                  <th className="py-2 pr-2">→ Next</th>
                  <th className="py-2 pr-2">Litres</th>
                  <th className="py-2 pr-2">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {matched.map(({ ev, stop }, i) => {
                  const next = matched[i + 1];
                  const driveToNextMs = next ? next.ev.startMs - ev.endMs : 0;
                  const dwellMs = ev.endMs - ev.startMs;
                  const litres = Number(stop?.delivered_litres) || 0;
                  const totalMin = (dwellMs + driveToNextMs) / 60000;
                  const lpm = totalMin > 0 ? litres / totalMin : 0;
                  const slow = dwellMs > medianDwell * 1.5;
                  const label = stop
                    ? `${stop.site_name}${clientNames[stop.client_account_id] ? ` · ${clientNames[stop.client_account_id]}` : ""}`
                    : "Unknown stop";
                  return (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2 pr-2 font-semibold">{i + 1}</td>
                      <td className="py-2 pr-2 max-w-[220px] truncate">{label}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{fmtTime(ev.startMs)}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{fmtTime(ev.endMs)}</td>
                      <td className={`py-2 pr-2 font-medium ${slow ? "text-destructive" : ""}`}>
                        {fmtHM(dwellMs)}{slow && " ⚠"}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{next ? fmtHM(driveToNextMs) : "—"}</td>
                      <td className="py-2 pr-2">{litres > 0 ? `${litres.toLocaleString()} L` : "—"}</td>
                      <td className="py-2 pr-2">
                        {litres > 0 ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${lpm > 30 ? "bg-emerald-500/15 text-emerald-500" : lpm > 10 ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive"}`}>
                            {lpm.toFixed(0)} L/min
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground">
            Stops auto-detected when the driver stayed within 100 m for ≥ 3 minutes. ⚠ flags dwell &gt; 1.5× the day's median.
          </div>
        </div>
      )}
    </div>
  );
}