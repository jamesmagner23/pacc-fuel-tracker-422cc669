import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { MapPin, Truck, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

const MELB = { lng: 144.9631, lat: -37.8136 };

interface TruckMapProps {
  height?: number;
  showStops?: boolean;
  compact?: boolean;
}

function useTruckLocation() {
  return useQuery({
    queryKey: ["truck-location"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-truck-location");
        if (error) return { success: false, driver: null, route: null };
        return data;
      } catch {
        return { success: false, driver: null, route: null };
      }
    },
    retry: false,
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

function cssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function TruckMap({ height = 280, showStops = false, compact = false }: TruckMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, dataUpdatedAt, refetch } = useTruckLocation();
  const { data: mapToken, isLoading: isMapTokenLoading } = useMapboxToken();
  const driver = data?.driver;
  const route = data?.route;
  const hasLocation = !!(driver?.lat && driver?.lng);

  const mapBg = cssVar("--map-bg", "#1A1009");
  const mapBorder = cssVar("--map-border", "#2E1C0C");
  const accent = cssVar("--accent", "#FF4D1C");
  const textMuted = cssVar("--text-muted", "#8B7355");
  const textSecondary = cssVar("--text-secondary", "#C4A882");
  const textPrimary = cssVar("--text-primary", "#F2EDE6");

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
        .setLngLat([driver.lng, driver.lat])
        .addTo(mapRef.current);
    } else {
      markerRef.current.setLngLat([driver.lng, driver.lat]);
    }

    mapRef.current.flyTo({
      center: [driver.lng, driver.lat],
      zoom: 13,
      duration: 1200,
    });
  }, [mapReady, hasLocation, driver?.lat, driver?.lng, accent]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Truck style={{ width: 14, height: 14, color: accent }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: textPrimary, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Live Truck Location
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastUpdated && <span style={{ fontSize: 10, color: textMuted }}>Updated {lastUpdated}</span>}
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: textMuted }}
              title={expanded ? "Collapse map" : "Expand map"}
            >
              {expanded ? <Minimize2 style={{ width: 12, height: 12 }} /> : <Maximize2 style={{ width: 12, height: 12 }} />}
            </button>
            <button
              onClick={() => refetch()}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: textMuted }}
            >
              <RefreshCw style={{ width: 12, height: 12 }} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      )}

      <div ref={mapContainer} style={{ height: mapHeight, width: "100%", transition: "height 0.3s ease" }} />

      {!hasLocation && !isLoading && mapReady && (
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
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block", boxShadow: "0 0 6px #10B981" }} />
          <span style={{ fontSize: 10, color: textSecondary, fontWeight: 500 }}>
            {driver?.lastUpdate
              ? `Last seen ${new Date(driver.lastUpdate).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })}`
              : "LAST KNOWN"}
          </span>
        </div>
      )}
    </div>
  );
}
