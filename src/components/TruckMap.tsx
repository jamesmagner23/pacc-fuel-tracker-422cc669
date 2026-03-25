import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Truck, RefreshCw } from "lucide-react";

const MAPBOX_TOKEN = "pk.eyJ1IjoicGFjY2VuZXJneSIsImEiOiJjbW41ZGRwdDIwOXNwMnNwb3BlaGQ0ZDY2In0.ie912dCPZJAjj-63ytswgw";

// Melbourne default centre
const MELB = { lng: 144.9631, lat: -37.8136 };

interface TruckMapProps {
  height?: number;
  showStops?: boolean; // show completed/pending stop count
  compact?: boolean;   // compact mode for customer portal
}

function useTruckLocation() {
  return useQuery({
    queryKey: ["truck-location"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-truck-location");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // refresh every 30 seconds
    staleTime: 25000,
  });
}

export function TruckMap({ height = 280, showStops = false, compact = false }: TruckMapProps) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);

  const { data, isLoading, dataUpdatedAt, refetch } = useTruckLocation();

  const driver = data?.driver;
  const route = data?.route;
  const hasLocation = driver?.lat && driver?.lng;

  // Load Mapbox GL JS dynamically
  useEffect(() => {
    if ((window as any).mapboxgl) {
      setMapboxLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/mapbox-gl/2.15.0/mapbox-gl.min.js";
    script.onload = () => setMapboxLoaded(true);
    document.head.appendChild(script);

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/mapbox-gl/2.15.0/mapbox-gl.min.css";
    document.head.appendChild(link);
  }, []);

  // Initialise map
  useEffect(() => {
    if (!mapboxLoaded || !mapContainer.current || mapRef.current) return;

    const mapboxgl = (window as any).mapboxgl;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [MELB.lng, MELB.lat],
      zoom: 10,
      attributionControl: false,
      logoPosition: "bottom-right",
    });

    map.on("load", () => {
      // Warm brown overlay tint
      map.setPaintProperty("background", "background-color", "#110B06");
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxLoaded]);

  // Update truck marker when location changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const mapboxgl = (window as any).mapboxgl;
    const map = mapRef.current;

    if (!hasLocation) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    // Custom truck marker element
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 36px;
        height: 36px;
        background: #FF4D1C;
        border: 3px solid #F2EDE6;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 0 4px rgba(255,77,28,0.25), 0 4px 12px rgba(0,0,0,0.4);
        cursor: pointer;
      `;
      el.innerHTML = ``;

      markerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([driver.lng, driver.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([driver.lng, driver.lat]);
    }

    // Smooth fly to truck
    map.flyTo({
      center: [driver.lng, driver.lat],
      zoom: 13,
      duration: 1500,
      essential: true,
    });
  }, [mapLoaded, hasLocation, driver?.lat, driver?.lng]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#110B06", border: "1px solid rgba(139,115,85,0.2)" }}>

      {/* Header */}
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(139,115,85,0.15)" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Truck size={16} color="#E8461E" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#F2EDE6", letterSpacing: "0.02em" }}>
              Live Truck Location
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: "#8B7355" }}>Updated {lastUpdated}</span>
            )}
            <button
              onClick={() => refetch()}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4A3520", display: "flex", alignItems: "center" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#8B7355")}
              onMouseLeave={e => (e.currentTarget.style.color = "#4A3520")}
            >
              <RefreshCw size={14} />
            </button>
          </div>

        </div>
      )}

      {/* Map */}
      <div ref={mapContainer} style={{ width: "100%", height }} />

      {/* Status overlay */}
      {!hasLocation && !isLoading && (
        <div style={{ position: "absolute", inset: 0, top: compact ? 0 : 45, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(17,11,6,0.85)", color: "#8B7355", gap: 8 }}>
          <MapPin size={24} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Truck location unavailable</span>
          <span style={{ fontSize: 11, color: "#4A3520" }}>Driver may be offline</span>
        </div>
      )}

      {isLoading && !mapLoaded && (
        <div style={{ position: "absolute", inset: 0, top: compact ? 0 : 45, display: "flex", alignItems: "center", justifyContent: "center", color: "#8B7355", fontSize: 13 }}>
          Loading map…
        </div>
      )}

      {/* Stop counter badge */}
      {showStops && route && (
        <div style={{ position: "absolute", top: compact ? 8 : 53, right: 8, background: "rgba(17,11,6,0.9)", border: "1px solid rgba(139,115,85,0.3)", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#F2EDE6" }}>
          <span style={{ color: "#8B7355", fontWeight: 500 }}>Stops</span>
          <span style={{ color: "#E8461E", fontWeight: 700 }}>{route.completed}</span>
          <span style={{ color: "#4A3520" }}>/ {route.total}</span>
        </div>
      )}

      {/* Live indicator */}
      {hasLocation && (
        <div style={{ position: "absolute", top: compact ? 8 : 53, left: 8, background: "rgba(17,11,6,0.9)", border: "1px solid rgba(232,70,30,0.3)", borderRadius: 6, padding: "4px 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8461E", boxShadow: "0 0 6px #E8461E" }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: "#E8461E", letterSpacing: "0.08em" }}>LIVE</span>
        </div>
      )}
    </div>
  );
}