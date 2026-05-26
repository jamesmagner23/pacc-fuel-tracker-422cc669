import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { useLatestTruckLocation } from "@/hooks/useLatestTruckLocation";
import { MapPin, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import { useDemo } from "@/hooks/useDemo";

const MELB = { lng: 144.9631, lat: -37.8136 };

// Fake truck fleet for demo mode — 4 trucks orbiting different points
// around metro Melbourne so the "Live Truck Location" card feels alive.
const DEMO_TRUCKS = [
  { id: "BOWSR-01", driver: "Jake Mitchell", center: { lng: 145.215, lat: -37.987 } }, // Dandenong
  { id: "BOWSR-02", driver: "Sarah Chen",    center: { lng: 144.752, lat: -37.866 } }, // Laverton
  { id: "BOWSR-03", driver: "Tom Bradley",   center: { lng: 145.030, lat: -37.654 } }, // Epping
  { id: "BOWSR-04", driver: "Liam Foster",   center: { lng: 145.061, lat: -37.910 } }, // Moorabbin
];

interface TruckMapProps {
  height?: number;
  showStops?: boolean;
  compact?: boolean;
}

function cssVar(name: string, fallback = "", el?: Element | null): string {
  if (typeof window === "undefined") return fallback;
  const target = el || document.documentElement;
  return getComputedStyle(target).getPropertyValue(name).trim() || fallback;
}

export function TruckMap({ height = 280, showStops = false, compact = false }: TruckMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const demoMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const demoFrameRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<{ lng: number; lat: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // Forces a re-read of CSS vars after the container is mounted so we
  // pick up portal-scoped overrides (light theme) rather than :root.
  const [, setVarTick] = useState(0);
  useEffect(() => { setVarTick((n) => n + 1); }, []);

  const isDemo = useDemo();
  const { data: ping, isFetching, refetch } = useLatestTruckLocation();
  const { data: mapToken, isLoading: isMapTokenLoading } = useMapboxToken();
  const driver = isDemo
    ? { name: DEMO_TRUCKS[0].driver, lat: DEMO_TRUCKS[0].center.lat, lng: DEMO_TRUCKS[0].center.lng, lastUpdate: new Date().toISOString() }
    : ping
    ? { name: ping.driver_name || "Driver", lat: ping.lat, lng: ping.lng, lastUpdate: ping.recorded_at }
    : null;
  const route = null as null | { completed: number; total: number };
  const hasLocation = isDemo ? true : !!(driver?.lat && driver?.lng);

  const scopeEl = mapContainer.current?.parentElement || null;
  const mapBg = cssVar("--map-bg", "#0A1A0C", scopeEl);
  const mapBorder = cssVar("--map-border", "#1A301D", scopeEl);
  const accent = cssVar("--accent", "#C8F26A", scopeEl);
  const textMuted = cssVar("--text-muted", "#8B8773", scopeEl);
  const textSecondary = cssVar("--text-secondary", "#C7BFAC", scopeEl);
  const textPrimary = cssVar("--text-primary", "#ECE4D2", scopeEl);

  useEffect(() => {
    if (mapRef.current && mapReady) {
      setTimeout(() => mapRef.current?.resize(), 50);
    }
  }, [expanded, mapReady]);

  useEffect(() => {
    if (!mapContainer.current) return;

    let cancelled = false;
    setMapReady(false);
    setMapError(false);

    markerRef.current?.remove();
    markerRef.current = null;
    mapRef.current?.remove();
    mapRef.current = null;

    if (isMapTokenLoading) return;

    if (!mapToken) {
      setMapError(true);
      return;
    }

    mapboxgl.accessToken = mapToken;

    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [MELB.lng, MELB.lat],
        zoom: 10,
        attributionControl: false,
      });

      mapRef.current = map;

      const loadTimeout = window.setTimeout(() => {
        if (!cancelled) setMapError(true);
      }, 8000);

      map.on("load", () => {
        window.clearTimeout(loadTimeout);
        if (!cancelled) {
          setMapReady(true);
          setMapError(false);
          // Ensure correct sizing once container is laid out
          requestAnimationFrame(() => {
            try { map.resize(); } catch { /* noop */ }
          });
        }
      });

      map.on("error", () => {
        window.clearTimeout(loadTimeout);
        if (!cancelled) setMapError(true);
      });

      return () => {
        cancelled = true;
        window.clearTimeout(loadTimeout);
        map.remove();
        mapRef.current = null;
      };
    } catch {
      setMapError(true);
    }
  }, [mapToken, isMapTokenLoading, mapAttempt]);

  useEffect(() => {
    if (!mapReady || !hasLocation || !mapRef.current || !driver) return;
    // In demo mode we paint a fleet of fake animated trucks instead of
    // tracking the single live driver ping.
    if (isDemo) return;

    const target = { lng: driver.lng as number, lat: driver.lat as number };

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = `
        width:16px;height:16px;
        background:${accent};
        border-radius:50%;
        box-shadow:0 0 0 6px ${accent}33,0 0 0 12px ${accent}14,0 2px 8px rgba(0,0,0,0.3);
        cursor:pointer;
      `;

      markerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([target.lng, target.lat])
        .addTo(mapRef.current);
      lastCoordsRef.current = target;
      mapRef.current.flyTo({ center: [target.lng, target.lat], zoom: 13, duration: 1200 });
      return;
    } else {
      const start = lastCoordsRef.current ?? target;
      if (start.lng === target.lng && start.lat === target.lat) {
        markerRef.current.setLngLat([target.lng, target.lat]);
      } else {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        const duration = 1200;
        const startTime = performance.now();
        const ease = (t: number) => 1 - Math.pow(1 - t, 3);
        const tick = (now: number) => {
          const t = Math.min(1, (now - startTime) / duration);
          const k = ease(t);
          const lng = start.lng + (target.lng - start.lng) * k;
          const lat = start.lat + (target.lat - start.lat) * k;
          markerRef.current?.setLngLat([lng, lat]);
          if (t < 1) {
            animFrameRef.current = requestAnimationFrame(tick);
          } else {
            animFrameRef.current = null;
            lastCoordsRef.current = target;
          }
        };
        animFrameRef.current = requestAnimationFrame(tick);
      }
      lastCoordsRef.current = target;
      mapRef.current.flyTo({ center: [target.lng, target.lat], zoom: 13, duration: 1200 });
      return;
    }
  }, [mapReady, hasLocation, driver?.lat, driver?.lng, accent]);

  // Demo-mode fleet: render 4 markers and animate them around small loops.
  useEffect(() => {
    if (!isDemo || !mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Clean any previous markers (effect re-runs on theme/accent change).
    demoMarkersRef.current.forEach((m) => m.remove());
    demoMarkersRef.current = [];

    DEMO_TRUCKS.forEach((t) => {
      const el = document.createElement("div");
      el.style.cssText = `
        width:14px;height:14px;
        background:${accent};
        border-radius:50%;
        box-shadow:0 0 0 5px ${accent}33,0 0 0 10px ${accent}14,0 2px 6px rgba(0,0,0,0.3);
      `;
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([t.center.lng, t.center.lat])
        .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(
          `<div style="font-size:12px;font-weight:600;color:#111">${t.id}</div><div style="font-size:11px;color:#555">${t.driver}</div>`
        ))
        .addTo(map);
      demoMarkersRef.current.push(marker);
    });

    // Fit map to show all trucks
    try {
      const bounds = new mapboxgl.LngLatBounds();
      DEMO_TRUCKS.forEach((t) => bounds.extend([t.center.lng, t.center.lat]));
      map.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 11 });
    } catch { /* noop */ }

    const start = performance.now();
    const radius = 0.012; // ~1.3km loop
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      DEMO_TRUCKS.forEach((t, i) => {
        // Each truck loops at a different speed + phase
        const speed = 0.18 + i * 0.04;
        const phase = (i * Math.PI) / 2;
        const lng = t.center.lng + Math.cos(elapsed * speed + phase) * radius;
        const lat = t.center.lat + Math.sin(elapsed * speed + phase) * radius * 0.7;
        demoMarkersRef.current[i]?.setLngLat([lng, lat]);
      });
      demoFrameRef.current = requestAnimationFrame(tick);
    };
    demoFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (demoFrameRef.current) cancelAnimationFrame(demoFrameRef.current);
      demoMarkersRef.current.forEach((m) => m.remove());
      demoMarkersRef.current = [];
    };
  }, [isDemo, mapReady, accent]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const locationTimestamp = driver?.lastUpdate ? new Date(driver.lastUpdate) : null;
  const todayKey = new Date().toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" });
  const tsKey = locationTimestamp?.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" });
  const isToday = locationTimestamp && tsKey === todayKey;
  const locationAgeMs = locationTimestamp ? Date.now() - locationTimestamp.getTime() : null;
  const isStaleLocation = !locationTimestamp || locationAgeMs === null || locationAgeMs > 1000 * 60 * 60;
  const lastUpdatedLabel = locationTimestamp
    ? isToday
      ? locationTimestamp.toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Australia/Melbourne",
        }).replace(/\s?(am|pm|AM|PM)/, (m) => m.trim().toLowerCase())
      : locationTimestamp.toLocaleString("en-AU", {
          day: "2-digit",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Australia/Melbourne",
        }).replace(/\s?(am|pm|AM|PM)/, (m) => m.trim().toLowerCase())
    : null;

  const mapHeight = expanded ? 520 : height;

  return (
    <div
      style={{
        background: mapBg,
        border: `1px solid ${mapBorder}`,
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
        transition: "all 0.3s ease",
      }}
    >
      {!compact && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: `1px solid ${mapBorder}`,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 500, color: textPrimary, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {isStaleLocation ? "Last Known Truck Location" : "Live Truck Location"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastUpdatedLabel && (
              <span
                style={{ fontSize: 10, color: textMuted }}
                title={locationTimestamp?.toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })}
              >
                Updated {lastUpdatedLabel}
              </span>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: textMuted }}
              title={expanded ? "Collapse map" : "Expand map"}
            >
              {expanded ? <Minimize2 style={{ width: 12, height: 12 }} /> : <Maximize2 style={{ width: 12, height: 12 }} />}
            </button>
            <button
              onClick={() => {
                refetch({ cancelRefetch: true });
                if (mapRef.current) {
                  try { mapRef.current.resize(); } catch { /* noop */ }
                }
              }}
              title="Refresh truck location"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: `1px solid ${mapBorder}`,
                borderRadius: 999,
                cursor: isFetching ? "wait" : "pointer",
                color: textSecondary,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.02em",
                minHeight: 28,
              }}
            >
              <RefreshCw style={{ width: 12, height: 12 }} className={isFetching ? "animate-spin" : ""} />
              <span>{isFetching ? "Refreshing…" : "Refresh location"}</span>
            </button>
          </div>
        </div>
      )}

      <div ref={mapContainer} style={{ height: mapHeight, width: "100%", transition: "height 0.3s ease" }} />

      {!hasLocation && !isFetching && mapReady && (
        <div
          style={{
            position: "absolute",
            top: compact ? 0 : 45,
            left: 0, right: 0, bottom: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: `${mapBg}cc`,
            gap: 6,
          }}
        >
          <MapPin style={{ width: 18, height: 18, color: textMuted }} />
          <span style={{ fontSize: 12, color: textSecondary }}>Truck location unavailable</span>
          <span style={{ fontSize: 11, color: textMuted }}>Driver may be offline</span>
        </div>
      )}

      {!mapReady && (
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: mapBg, gap: 6,
          }}
        >
          {mapError ? (
            <>
              <MapPin style={{ width: 18, height: 18, color: textMuted }} />
              <span style={{ fontSize: 12, color: textSecondary }}>Map failed to load</span>
              <button
                onClick={() => setMapAttempt((value) => value + 1)}
                style={{ fontSize: 11, color: accent, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Retry
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: textMuted }}>Loading map…</span>
          )}
        </div>
      )}

      {showStops && route && (
        <div
          style={{
            position: "absolute", bottom: 12, left: 12,
            background: `${mapBg}eb`,
            border: `1px solid ${mapBorder}`,
            borderRadius: 20, padding: "5px 12px",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 11, color: textSecondary }}>Stops</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: accent }}>{route.completed}</span>
          <span style={{ fontSize: 11, color: textMuted }}>/ {route.total}</span>
        </div>
      )}

      {hasLocation && (
        <div
          style={{
            position: "absolute",
            top: compact ? 8 : 52, right: 12,
            background: `${mapBg}eb`,
            border: `1px solid ${mapBorder}`,
            borderRadius: 20, padding: "4px 10px",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isStaleLocation ? accent : "#C8F26A",
              display: "inline-block",
              boxShadow: isStaleLocation ? `0 0 6px ${accent}` : "0 0 6px #C8F26A",
            }}
          />
          <span style={{ fontSize: 10, color: textSecondary, fontWeight: 500 }}>
            {driver?.lastUpdate
              ? isStaleLocation
                ? `Last known ${new Date(driver.lastUpdate).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })}`
                : `Live ${new Date(driver.lastUpdate).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" }).replace(/\s?(am|pm|AM|PM)/, (m) => m.trim().toLowerCase())}`
              : "LAST KNOWN"}
          </span>
        </div>
      )}
    </div>
  );
}
