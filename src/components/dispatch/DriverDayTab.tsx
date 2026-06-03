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

// ---------- geocoding (client-side, cached in localStorage + DB writeback) ----------
const GEO_CACHE_KEY = "pacc.geocode.cache.v1";
function loadGeoCache(): Record<string, { lat: number; lng: number }> {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}"); } catch { return {}; }
}
function saveGeoCache(c: Record<string, { lat: number; lng: number }>) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(c)); } catch { /* noop */ }
}
async function geocodeAddress(address: string, token: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(address + ", Victoria, Australia");
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&country=AU&limit=1`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const c = j?.features?.[0]?.center;
    if (Array.isArray(c) && c.length === 2) return { lng: c[0], lat: c[1] };
  } catch { /* noop */ }
  return null;
}

function useGeocodedStops(stops: any[]) {
  const { data: token } = useMapboxToken();
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>(() => loadGeoCache());

  useEffect(() => {
    if (!token || stops.length === 0) return;
    let cancelled = false;
    (async () => {
      const cache = { ...loadGeoCache() };
      let mutated = false;
      for (const s of stops) {
        const key = String(s.id);
        if (s.latitude != null && s.longitude != null) {
          if (!cache[key]) {
            cache[key] = { lat: Number(s.latitude), lng: Number(s.longitude) };
            mutated = true;
          }
          continue;
        }
        if (cache[key]) continue;
        const addr = (s.address || s.site_name || "").trim();
        if (!addr) continue;
        const c = await geocodeAddress(addr, token);
        if (cancelled) return;
        if (c) {
          cache[key] = c;
          mutated = true;
          // Best-effort writeback so it survives across users/devices
          supabase
            .from("dispatch_stops")
            .update({ latitude: c.lat, longitude: c.lng })
            .eq("id", s.id)
            .then(() => { /* noop */ }, () => { /* noop */ });
        }
      }
      if (mutated && !cancelled) {
        saveGeoCache(cache);
        setCoords(cache);
      }
    })();
    return () => { cancelled = true; };
  }, [token, stops]);

  return coords;
}

// ---------- Mapbox driving directions between scheduled stops ----------
function useRouteBetweenStops(
  markers: Array<{ id: string; lat: number; lng: number; sequence: number }>,
) {
  const { data: token } = useMapboxToken();
  const key = markers.map((m) => `${m.lng.toFixed(5)},${m.lat.toFixed(5)}`).join(";");
  return useQuery({
    queryKey: ["driver-day-route", key],
    enabled: !!token && markers.length >= 2,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      // Mapbox Directions caps at 25 coordinates per request.
      const pts = markers.slice(0, 25);
      const coords = pts.map((m) => `${m.lng},${m.lat}`).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("directions failed");
      const j = await r.json();
      const route = j?.routes?.[0];
      if (!route) return null;
      return {
        geometry: route.geometry as GeoJSON.LineString,
        distanceKm: (route.distance || 0) / 1000,
        durationMin: (route.duration || 0) / 60,
      };
    },
  });
}

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
const SITE_VISIT_RADIUS_KM = 0.5; // pings within 500 m of a scheduled site count as a confirmed GPS visit
const SITE_VISIT_NEAR_RADIUS_KM = 1.25; // allow for imperfect geocodes on completed/delivered stops
const SITE_VISIT_GAP_MIN = 10; // pings separated by >10 min away from site break the visit
const TX_GROUP_GAP_MIN = 35; // split fuel log groups when transactions are far apart

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

// Infer when the driver was physically at a scheduled site, using GPS pings.
// Returns the longest contiguous run of pings within SITE_VISIT_RADIUS_KM,
// independent of any "complete" button press by the driver.
function inferSiteVisit(
  site: { lat: number; lng: number },
  pings: Ping[],
  radiusKm = SITE_VISIT_RADIUS_KM,
): { arrivedMs: number; leftMs: number; dwellMs: number; pingCount: number } | null {
  if (pings.length === 0) return null;
  const near = pings
    .map((p) => ({ p, d: haversineKm(p, site) }))
    .filter((x) => x.d <= radiusKm);
  if (near.length === 0) return null;

  // Split into contiguous runs (max 10 min gap between consecutive near-pings)
  const runs: Ping[][] = [];
  let cur: Ping[] = [near[0].p];
  for (let i = 1; i < near.length; i++) {
    const prev = cur[cur.length - 1];
    if ((near[i].p.t - prev.t) / 60000 <= SITE_VISIT_GAP_MIN) {
      cur.push(near[i].p);
    } else {
      runs.push(cur);
      cur = [near[i].p];
    }
  }
  runs.push(cur);

  // Pick the longest run by duration
  let best = runs[0];
  let bestDur = best[best.length - 1].t - best[0].t;
  for (const r of runs) {
    const d = r[r.length - 1].t - r[0].t;
    if (d > bestDur) { best = r; bestDur = d; }
  }

  return {
    arrivedMs: best[0].t,
    leftMs: best[best.length - 1].t,
    dwellMs: best[best.length - 1].t - best[0].t,
    pingCount: best.length,
  };
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

function localOperationalRangeIso(dateStr: string, hours = 30) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setHours(end.getHours() + hours);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function normName(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ---------- data hooks ----------
function useDriverPings(driverId: string | null, dateStr: string) {
  return useQuery({
    queryKey: ["driver-day-pings", driverId, dateStr],
    enabled: !!driverId,
    queryFn: async () => {
      const { startIso, endIso } = localOperationalRangeIso(dateStr, 24);
      const { data, error } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, recorded_at, speed")
        .eq("driver_user_id", driverId!)
        .gte("recorded_at", startIso)
        .lt("recorded_at", endIso)
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
        .select("id, site_name, address, latitude, longitude, status, completed_at, delivered_litres, client_account_id, sequence, driver_user_id, truck_id")
        .eq("scheduled_date", dateStr)
        .order("sequence", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      const assignedToDriver = rows.filter((s: any) => s.driver_user_id === driverId);

      return {
        stops: assignedToDriver.length > 0 ? assignedToDriver : rows,
        showingDateFallback: assignedToDriver.length === 0 && rows.length > 0,
      };
    },
  });
}

function useClientNameMap(ids: number[]) {
  return useQuery({
    queryKey: ["client-name-map", ids.sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("client_accounts").select("id, company_name, speedsol_name, speedsol_names").in("id", ids);
      const map: Record<number, { company_name: string; matchNames: string[] }> = {};
      (data || []).forEach((c: any) => {
        map[c.id] = {
          company_name: c.company_name,
          matchNames: [c.company_name, c.speedsol_name, ...(Array.isArray(c.speedsol_names) ? c.speedsol_names : [])].filter(Boolean),
        };
      });
      return map;
    },
  });
}

function useDeliveryTransactionsForDay(dateStr: string) {
  return useQuery({
    queryKey: ["driver-day-transactions", dateStr],
    queryFn: async () => {
      const { startIso, endIso } = localOperationalRangeIso(dateStr, 30);
      const { data, error } = await supabase
        .from("transactions")
        .select("id, fecha, nombre_cliente1, cantidad, placa, estacion, nombre_vendedor")
        .gte("fecha", startIso)
        .lt("fecha", endIso)
        .order("fecha", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: number; fecha: string; nombre_cliente1: string | null; cantidad: number | null; placa: string | null; estacion: string | null; nombre_vendedor: string | null }>;
    },
  });
}

function inferTransactionVisit(
  matchNames: string[] | undefined,
  transactions: Array<{ fecha: string; nombre_cliente1: string | null; cantidad: number | null }>,
  targetLitres?: number,
): { arrivedMs: number; leftMs: number; dwellMs: number; litres: number; txCount: number } | null {
  const needles = (matchNames || []).map(normName).filter((n) => n.length >= 3);
  if (needles.length === 0) return null;
  const matches = transactions
    .filter((t) => {
      const hay = normName(t.nombre_cliente1);
      if (hay.length < 3) return false;
      return needles.some((n) => hay.includes(n) || n.includes(hay));
    })
    .map((t) => ({ t: new Date(t.fecha).getTime(), litres: Number(t.cantidad) || 0 }))
    .filter((t) => Number.isFinite(t.t))
    .sort((a, b) => a.t - b.t);
  if (matches.length === 0) return null;

  const groups: typeof matches[] = [];
  let cur = [matches[0]];
  for (let i = 1; i < matches.length; i++) {
    if ((matches[i].t - cur[cur.length - 1].t) / 60000 <= TX_GROUP_GAP_MIN) cur.push(matches[i]);
    else { groups.push(cur); cur = [matches[i]]; }
  }
  groups.push(cur);
  const groupLitres = (g: typeof matches) => g.reduce((s, x) => s + x.litres, 0);
  const best = targetLitres && targetLitres > 0
    ? groups.reduce((a, b) => Math.abs(groupLitres(b) - targetLitres) < Math.abs(groupLitres(a) - targetLitres) ? b : a, groups[0])
    : groups.reduce((a, b) => (groupLitres(b) > groupLitres(a) ? b : a), groups[0]);
  const arrivedMs = best[0].t;
  const leftMs = best[best.length - 1].t;
  return {
    arrivedMs,
    leftMs,
    dwellMs: Math.max(leftMs - arrivedMs, 8 * 60 * 1000),
    litres: groupLitres(best),
    txCount: best.length,
  };
}

// ---------- map ----------
function DriverDayMap({
  pings,
  stopEvents,
  scheduledStops,
  routeGeometry,
  height = 460,
}: {
  pings: Ping[];
  stopEvents: StopEvent[];
  scheduledStops: Array<{ id: string; lat: number; lng: number; sequence: number; site_name: string; status: string; client?: string; arrivedMs?: number | null; leftMs?: number | null; dwellMs?: number | null; visitSource?: "gps" | "gps-near" | "fuel-log" | "none" }>;
  routeGeometry?: GeoJSON.LineString | null;
  height?: number;
}) {
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
    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getSource("route")) map.removeSource("route");
    if (map.getLayer("trail-line")) map.removeLayer("trail-line");
    if (map.getSource("trail")) map.removeSource("trail");

    // Driving route between scheduled stops (solid orange)
    if (routeGeometry && routeGeometry.coordinates?.length >= 2) {
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: routeGeometry },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f04a1a", "line-width": 4, "line-opacity": 0.9 },
      });
    }

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
        paint: { "line-color": "#120a04", "line-width": 2, "line-opacity": 0.55, "line-dasharray": [2, 2] },
      });
    }

    // Markers (remove old DOM markers we added previously)
    document.querySelectorAll(".dd-stop-marker").forEach((el) => el.remove());
    document.querySelectorAll(".dd-sched-marker").forEach((el) => el.remove());

    // Scheduled stops — solid pins with sequence number, status-coloured
    scheduledStops.forEach((s) => {
      const completed = s.status === "completed";
      const bg = completed ? "#16a34a" : "#f04a1a";
      const el = document.createElement("div");
      el.className = "dd-sched-marker";
      el.style.cssText = `
        width:30px;height:30px;border-radius:50%;
        background:${bg};color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-size:12px;font-weight:700;
        border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);
        cursor:pointer;
      `;
      el.textContent = String(s.sequence ?? "");
      const sourceLabel = s.visitSource === "fuel-log" ? "fuel log" : s.visitSource === "gps-near" ? "near GPS" : s.visitSource === "gps" ? "GPS" : "";
      const timingHtml = s.arrivedMs && s.leftMs
        ? `<div style="font-size:11px;color:#444;margin-top:4px">Arrived ${fmtTime(s.arrivedMs)} · Left ${fmtTime(s.leftMs)}</div>
           <div style="font-size:11px;color:#444">On site approx ${fmtHM(s.dwellMs || 0)}${sourceLabel ? ` · ${sourceLabel}` : ""}</div>`
        : `<div style="font-size:11px;color:#999;margin-top:4px;font-style:italic">No GPS dwell match</div>`;
      new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([s.lng, s.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
            `<div style="font-size:12px;font-weight:600;color:#120a04">#${s.sequence} ${s.site_name}</div>
             ${s.client ? `<div style="font-size:11px;color:#555">${s.client}</div>` : ""}
             <div style="font-size:11px;color:${completed ? "#16a34a" : "#f04a1a"};font-weight:600;margin-top:2px">${s.status.toUpperCase()}</div>
             ${timingHtml}`
          )
        )
        .addTo(map);
    });

    // GPS-detected stop clusters (smaller, secondary)
    stopEvents.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "dd-stop-marker";
      el.style.cssText = `
        width:18px;height:18px;border-radius:50%;
        background:#120a04;color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-size:9px;font-weight:700;
        border:1.5px solid #fbbf24;box-shadow:0 2px 4px rgba(0,0,0,0.3);
      `;
      el.textContent = "G";
      new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([s.centroid.lng, s.centroid.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
            `<div style="font-size:12px;font-weight:600;color:#120a04">GPS cluster ${i + 1}</div>
             <div style="font-size:11px;color:#444">${fmtTime(s.startMs)} – ${fmtTime(s.endMs)}</div>
             <div style="font-size:11px;color:#444">Dwell ${fmtHM(s.endMs - s.startMs)}</div>`
          )
        )
        .addTo(map);
    });

    // Fit bounds — include both pings and scheduled stops so the view
    // reflects the work, not just the (often sparse) GPS trail.
    if (pings.length > 0 || scheduledStops.length > 0) {
      const b = new mapboxgl.LngLatBounds();
      pings.forEach((p) => b.extend([p.lng, p.lat]));
      scheduledStops.forEach((s) => b.extend([s.lng, s.lat]));
      try { map.fitBounds(b, { padding: 50, duration: 600, maxZoom: 14 }); } catch { /* noop */ }
    }
  }, [ready, pings, stopEvents, scheduledStops, routeGeometry]);

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
  const { data: stopResult, isLoading: stopsLoading } = useDriverStopsForDay(driverId, dateStr);
  const stops = stopResult?.stops ?? [];
  const showingDateFallback = !!stopResult?.showingDateFallback;
  const clientIds = useMemo(() => Array.from(new Set(stops.map((s: any) => s.client_account_id).filter(Boolean))), [stops]);
  const { data: clientNames = {} } = useClientNameMap(clientIds as number[]);
  const { data: deliveryTransactions = [] } = useDeliveryTransactionsForDay(dateStr);

  const stopEvents = useMemo(() => detectStops(pings), [pings]);
  const geo = useGeocodedStops(stops as any[]);

  const scheduledMarkersBase = useMemo(() => {
    return (stops as any[])
      .map((s, index) => {
        const c = geo[String(s.id)] || (s.latitude != null && s.longitude != null ? { lat: Number(s.latitude), lng: Number(s.longitude) } : null);
        if (!c) return null;
        return {
          id: String(s.id),
          lat: c.lat,
          lng: c.lng,
          sequence: index + 1,
          site_name: s.site_name,
          status: s.status,
          client: clientNames[s.client_account_id]?.company_name,
          matchNames: clientNames[s.client_account_id]?.matchNames ?? [s.site_name],
          completed_at: s.completed_at ?? null,
        };
      })
      .filter(Boolean) as Array<{ id: string; lat: number; lng: number; sequence: number; site_name: string; status: string; client?: string; matchNames: string[]; completed_at: string | null }>;
  }, [stops, geo, clientNames]);

  // Match each scheduled marker to a detected GPS stop cluster so we can
  // surface accurate arrival / departure / dwell in the popup.
  const scheduledMarkers = useMemo(() => {
    return scheduledMarkersBase.map((m) => {
      // Source of truth = GPS pings physically near this site, NOT
      // the driver pressing "complete" (which can happen anywhere/anytime).
      const scheduledStop = (stops as any[]).find((s) => String(s.id) === m.id);
      const txVisit = inferTransactionVisit(m.matchNames, deliveryTransactions, Number(scheduledStop?.delivered_litres) || undefined);
      if (txVisit) {
        return {
          ...m,
          arrivedMs: txVisit.arrivedMs,
          leftMs: txVisit.leftMs,
          dwellMs: txVisit.dwellMs,
          visitSource: "fuel-log" as const,
          loggedLitres: txVisit.litres,
          txCount: txVisit.txCount,
        };
      }
      const visit = inferSiteVisit({ lat: m.lat, lng: m.lng }, pings);
      if (visit) {
        return {
          ...m,
          arrivedMs: visit.arrivedMs,
          leftMs: visit.leftMs,
          dwellMs: visit.dwellMs,
          visitSource: "gps" as const,
        };
      }
      const nearVisit = inferSiteVisit({ lat: m.lat, lng: m.lng }, pings, SITE_VISIT_NEAR_RADIUS_KM);
      if (nearVisit && (m.status === "completed" || Number((stops as any[]).find((s) => String(s.id) === m.id)?.delivered_litres) > 0)) {
        return {
          ...m,
          arrivedMs: nearVisit.arrivedMs,
          leftMs: nearVisit.leftMs,
          dwellMs: nearVisit.dwellMs,
          visitSource: "gps-near" as const,
        };
      }
      return { ...m, arrivedMs: null, leftMs: null, dwellMs: null, visitSource: "none" as const };
    });
  }, [scheduledMarkersBase, pings, stops, deliveryTransactions]);

  const routeMarkers = useMemo(() => {
    const visited = scheduledMarkers.filter((m) => m.arrivedMs != null).sort((a, b) => (a.arrivedMs as number) - (b.arrivedMs as number));
    return visited.length >= 2 ? visited : scheduledMarkers;
  }, [scheduledMarkers]);

  const { data: routeData } = useRouteBetweenStops(routeMarkers);

  const completedCount = useMemo(() => (stops as any[]).filter((s) => s.status === "completed").length, [stops]);
  const ungeocodedCount = (stops as any[]).length - scheduledMarkersBase.length;
  const sparseGps = pings.length > 0 && pings.length < 10;
  const noGps = pings.length === 0;

  // ----- metrics -----
  const metrics = useMemo(() => {
    if (pings.length < 2) {
      return { km: routeData?.distanceKm ?? 0, kmSource: routeData ? "route" : "none", shiftMs: 0, stoppedMs: 0, driveMs: 0, otMs: 0 };
    }
    let gpsKm = 0;
    for (let i = 1; i < pings.length; i++) gpsKm += haversineKm(pings[i - 1], pings[i]);
    // Prefer Mapbox driving distance when available — straight-line GPS
    // underestimates for sparse pings and overestimates for jittery ones.
    const km = routeData?.distanceKm ?? gpsKm;
    const kmSource = routeData ? "route" : "gps";
    const shiftMs = pings[pings.length - 1].t - pings[0].t;
    const stoppedMs = stopEvents.reduce((a, s) => a + (s.endMs - s.startMs), 0);
    const driveMs = Math.max(0, shiftMs - stoppedMs);
    const otMs = Math.max(0, shiftMs - 8 * 60 * 60 * 1000);
    return { km, kmSource, shiftMs, stoppedMs, driveMs, otMs };
  }, [pings, stopEvents, routeData]);

  const totalLitres = useMemo(
    () => stops.reduce((a: number, s: any) => a + (Number(s.delivered_litres) || 0), 0),
    [stops]
  );

  // Timeline = every scheduled stop, sorted by actual arrival time (GPS-inferred).
  // Unvisited stops fall to the bottom of the list.
  const timeline = useMemo(() => {
    const rows = scheduledMarkers.map((m) => {
      const stop = (stops as any[]).find((s) => String(s.id) === m.id);
      return { marker: m, stop };
    });
    rows.sort((a, b) => {
      const ta = a.marker.arrivedMs ?? Number.POSITIVE_INFINITY;
      const tb = b.marker.arrivedMs ?? Number.POSITIVE_INFINITY;
      return ta - tb;
    });
    return rows;
  }, [scheduledMarkers, stops]);

  const visitedRows = useMemo(() => timeline.filter((r) => r.marker.arrivedMs != null), [timeline]);
  const visitSourceCounts = useMemo(() => {
    return visitedRows.reduce((acc, r) => {
      const key = r.marker.visitSource || "none";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [visitedRows]);
  const sourceSummary = useMemo(() => {
    const parts = [
      visitSourceCounts.gps ? `${visitSourceCounts.gps} GPS` : "",
      visitSourceCounts["gps-near"] ? `${visitSourceCounts["gps-near"]} near GPS` : "",
      visitSourceCounts["fuel-log"] ? `${visitSourceCounts["fuel-log"]} fuel log` : "",
    ].filter(Boolean);
    return parts.length ? ` · ${parts.join(" / ")}` : "";
  }, [visitSourceCounts]);

  const medianDwell = useMemo(() => {
    const dwells = visitedRows.map((r) => r.marker.dwellMs || 0).filter((d) => d > 0).sort((a, b) => a - b);
    if (dwells.length === 0) return 0;
    return dwells[Math.floor(dwells.length / 2)];
  }, [visitedRows]);

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
          { label: "KM driven", value: metrics.km ? metrics.km.toFixed(1) : "—", icon: RouteIcon, sub: metrics.kmSource === "route" ? "best route" : metrics.kmSource === "gps" ? "from GPS" : undefined },
          { label: "Drive time", value: metrics.driveMs ? fmtHM(metrics.driveMs) : "—", icon: Gauge },
          { label: "Stopped", value: metrics.stoppedMs ? fmtHM(metrics.stoppedMs) : "—", icon: Timer },
          { label: "Stops", value: `${completedCount}/${(stops as any[]).length}`, icon: MapPin, sub: "completed / scheduled" },
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
            {k.sub && <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      {(noGps || sparseGps || ungeocodedCount > 0 || showingDateFallback) && (
        <div className="card p-3 border-l-4 border-l-amber-500 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] leading-relaxed">
            {showingDateFallback && <div><strong>Dispatch stops are not assigned to this driver.</strong> Showing all scheduled stops for this date so the map still reflects the run.</div>}
            {noGps && <div><strong>No GPS pings.</strong> Driver had location-share off all day — map shows scheduled stops only.</div>}
            {sparseGps && <div><strong>Sparse GPS ({pings.length} pings).</strong> Timings fall back to fuel logs where available; the GPS trail alone is not reliable for every stop.</div>}
            {ungeocodedCount > 0 && <div className="mt-1 text-muted-foreground">{ungeocodedCount} stop{ungeocodedCount === 1 ? "" : "s"} couldn't be placed on the map (missing address).</div>}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="card p-3">
        {pingsLoading || stopsLoading ? (
          <div className="text-xs text-muted-foreground py-12 text-center">Loading trail…</div>
        ) : pings.length === 0 && scheduledMarkers.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center">
            No GPS data or scheduled stops for this driver on {format(date, "dd MMM yyyy")}.<br />
            Driver needs to turn on <strong>Share my location</strong> in the driver portal.
          </div>
        ) : (
          <DriverDayMap pings={pings} stopEvents={stopEvents} scheduledStops={scheduledMarkers} routeGeometry={routeData?.geometry ?? null} height={460} />
        )}
      </div>

      {/* Stop timeline */}
      {timeline.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Stop timeline</div>
              <div className="text-[11px] text-muted-foreground">
                {visitedRows.length}/{timeline.length} stops timed{sourceSummary} · {totalLitres.toLocaleString()} L delivered{medianDwell > 0 ? ` · median dwell ${fmtHM(medianDwell)}` : ""}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-2">Planned #</th>
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
                {timeline.map(({ marker, stop }, i) => {
                  const next = timeline[i + 1];
                  const visited = marker.arrivedMs != null && marker.leftMs != null;
                  const dwellMs = marker.dwellMs || 0;
                  const driveToNextMs = visited && next?.marker.arrivedMs != null
                    ? Math.max(0, next.marker.arrivedMs - (marker.leftMs as number))
                    : 0;
                  const litres = Number(stop?.delivered_litres) || Number((marker as any).loggedLitres) || 0;
                  const totalMin = (dwellMs + driveToNextMs) / 60000;
                  const lpm = totalMin > 0 ? litres / totalMin : 0;
                  const slow = dwellMs > 0 && medianDwell > 0 && dwellMs > medianDwell * 1.5;
                  const label = `${marker.site_name}${marker.client ? ` · ${marker.client}` : ""}`;
                  const sourceLabel = marker.visitSource === "fuel-log" ? "fuel log" : marker.visitSource === "gps-near" ? "near GPS" : marker.visitSource === "gps" ? "GPS" : "";
                  return (
                    <tr key={marker.id} className={`border-b border-border last:border-0 ${!visited ? "opacity-60" : ""}`}>
                      <td className="py-2 pr-2 font-semibold">{marker.sequence}</td>
                      <td className="py-2 pr-2 max-w-[220px] truncate">{label}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{visited ? <span>{fmtTime(marker.arrivedMs as number)}{sourceLabel && <span className="block text-[9px] uppercase tracking-wider">{sourceLabel}</span>}</span> : <span className="italic">no timing evidence</span>}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{visited ? fmtTime(marker.leftMs as number) : "—"}</td>
                      <td className={`py-2 pr-2 font-medium ${slow ? "text-destructive" : ""}`}>
                        {visited ? `${fmtHM(dwellMs)}${slow ? " ⚠" : ""}` : "—"}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{driveToNextMs > 0 ? fmtHM(driveToNextMs) : "—"}</td>
                      <td className="py-2 pr-2">{litres > 0 ? `${litres.toLocaleString()} L` : "—"}</td>
                      <td className="py-2 pr-2">
                        {litres > 0 && totalMin > 0 ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${lpm > 30 ? "bg-positive/15 text-positive" : lpm > 10 ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive"}`}>
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
            Times use confirmed GPS first, then near-GPS for imperfect geocodes, then fuel transaction timestamps where GPS is missing — never the driver's "complete" tap.
            Rows ordered by inferred arrival time. Faded rows = no timing evidence for that site today. ⚠ flags dwell &gt; 1.5× the day's median.
          </div>
        </div>
      )}
    </div>
  );
}