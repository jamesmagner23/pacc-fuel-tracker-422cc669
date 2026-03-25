import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Truck, RefreshCw } from "lucide-react";

const MAPBOX_TOKEN = "pk.eyJ1IjoicGFjY2VuZXJneSIsImEiOiJjbW41ZGRwdDIwOXNwMnNwb3BlaGQ0ZDY2In0.ie912dCPZJAjj-63ytswgw";
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
      const { data, error } = await supabase.functions.invoke("get-truck-location");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

function loadMapbox(): Promise<any> {
  return new Promise((resolve) => {
    if ((window as any).mapboxgl) {
      resolve((window as any).mapboxgl);
      return;
    }

    // Load CSS
    if (!document.querySelector('link[href*="mapbox-gl"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/mapbox-gl/2.15.0/mapbox-gl.min.css";
      document.head.appendChild(link);
    }

    // Load JS
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/mapbox-gl/2.15.0/mapbox-gl.min.js";
    script.onload = () => {
      const mapboxgl = (window as any).mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      resolve(mapboxgl);
    };
    document.head.appendChild(script);
  });
}

export function TruckMap({ height = 280, showStops = false, compact = false }: TruckMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const { data, isLoading, dataUpdatedAt, refetch } = useTruckLocation();
  const driver = data?.driver;
  const route = data?.route;
  const hasLocation = !!(driver?.lat && driver?.lng);

  // Init map after Mapbox loads
  useEffect(() => {
    if (!mapContainer.current) return;
    let cancelled = false;

    loadMapbox().then((mapboxgl) => {
      if (cancelled || !mapContainer.current || mapRef.current) return;

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [MELB.lng, MELB.lat],
        zoom: 10,
        attributionControl: false,
      });

      map.on("load", () => {
        if (!cancelled) {
          mapRef.current = map;
          setMapReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Update marker when location arrives
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    if (!hasLocation) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = `
        width:36px;height:36px;
        background:#FF4D1C;
        border:3px solid #F2EDE6;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 0 6px rgba(255,77,28,0.2),0 4px 12px rgba(0,0,0,0.5);
        cursor:pointer;
      `;
      el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;

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
  }, [mapReady, hasLocation, driver?.lat, driver?.lng]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      style={{
        background: "#1A1009",
        border: "1px solid #2E1C0C",
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      {!compact && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #2E1C0C",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Truck style={{ width: 14, height: 14, color: "#FF4D1C" }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#F2EDE6",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Live Truck Location
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastUpdated && <span style={{ fontSize: 10, color: "#4A3520" }}>Updated {lastUpdated}</span>}
            <button
              onClick={() => refetch()}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4A3520" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#8B7355")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4A3520")}
            >
              <RefreshCw style={{ width: 12, height: 12 }} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      )}

      {/* Map container */}
      <div ref={mapContainer} style={{ height, width: "100%" }} />

      {/* No location overlay */}
      {!hasLocation && !isLoading && mapReady && (
        <div
          style={{
            position: "absolute",
            top: compact ? 0 : 45,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(17,10,6,0.8)",
            gap: 6,
          }}
        >
          <MapPin style={{ width: 18, height: 18, color: "#4A3520" }} />
          <span style={{ fontSize: 12, color: "#8B7355" }}>Truck location unavailable</span>
          <span style={{ fontSize: 11, color: "#4A3520" }}>Driver may be offline</span>
        </div>
      )}

      {/* Loading overlay */}
      {!mapReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1A1009",
          }}
        >
          <span style={{ fontSize: 12, color: "#4A3520" }}>Loading map…</span>
        </div>
      )}

      {/* Stop counter */}
      {showStops && route && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            background: "rgba(26,16,9,0.92)",
            border: "1px solid #2E1C0C",
            borderRadius: 20,
            padding: "5px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 11, color: "#8B7355" }}>Stops</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#FF4D1C" }}>{route.completed}</span>
          <span style={{ fontSize: 11, color: "#4A3520" }}>/ {route.total}</span>
        </div>
      )}

      {/* Live badge */}
      {hasLocation && (
        <div
          style={{
            position: "absolute",
            top: compact ? 8 : 52,
            right: 12,
            background: "rgba(26,16,9,0.92)",
            border: "1px solid #2E1C0C",
            borderRadius: 20,
            padding: "4px 10px",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#10B981",
              display: "inline-block",
              boxShadow: "0 0 6px #10B981",
            }}
          />
          <span style={{ fontSize: 10, color: "#8B7355", fontWeight: 500 }}>LIVE</span>
        </div>
      )}
    </div>
  );
}
