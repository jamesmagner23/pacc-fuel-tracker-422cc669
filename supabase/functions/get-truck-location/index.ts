import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPTIMOROUTE_KEY = Deno.env.get("OPTIMOROUTE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // 1. Get today's routes for stop data and driver info
    const routeRes = await fetch(
      `https://api.optimoroute.com/v1/get_routes?key=${OPTIMOROUTE_KEY}&date=${today}`,
      { method: "GET" }
    );

    if (!routeRes.ok) {
      const body = await routeRes.text();
      throw new Error(`OptimoRoute get_routes error: ${routeRes.status} - ${body}`);
    }

    const routeData = await routeRes.json();

    // 2. Get mobile events for last known GPS position
    const eventsRes = await fetch(
      `https://api.optimoroute.com/v1/get_events?key=${OPTIMOROUTE_KEY}&after_tag=`,
      { method: "GET" }
    );

    const eventsData = eventsRes.ok ? await eventsRes.json() : null;

    // Extract route summary from first route
    let routeSummary = null;
    let driverName = "Stephan";

    if (routeData?.routes?.length > 0) {
      const route = routeData.routes[0];
      driverName = route.driverName || "Stephan";
      const stops = route.stops || [];
      // Count completed stops by checking events
      const completedOrders = new Set<string>();
      if (eventsData?.events) {
        for (const evt of eventsData.events) {
          if (evt.event === "success" && evt.orderNo) {
            completedOrders.add(evt.orderNo);
          }
        }
      }
      const completed = stops.filter((s: any) => completedOrders.has(s.orderNo)).length;
      const total = stops.length;
      routeSummary = { completed, total, stops };
    }

    // 3. Extract last known position from events (most recent event with position)
    let driverLocation = null;
    if (eventsData?.events?.length > 0) {
      // Events are in chronological order, find the last one with a position
      for (let i = eventsData.events.length - 1; i >= 0; i--) {
        const evt = eventsData.events[i];
        if (evt.position?.latitude && evt.position?.longitude) {
          driverLocation = {
            lat: evt.position.latitude,
            lng: evt.position.longitude,
            timestamp: evt.position.timestamp,
            event: evt.event,
          };
          if (evt.driverName) driverName = evt.driverName;
          break;
        }
      }
    }

    // 4. Fallback: use the last stop's location from the route if no event position
    if (!driverLocation && routeData?.routes?.length > 0) {
      const stops = routeData.routes[0].stops || [];
      if (stops.length > 0) {
        const lastStop = stops[stops.length - 1];
        if (lastStop.latitude && lastStop.longitude) {
          driverLocation = {
            lat: lastStop.latitude,
            lng: lastStop.longitude,
            timestamp: null,
            event: "route_stop",
          };
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        driver: driverLocation ? {
          name: driverName,
          lat: driverLocation.lat,
          lng: driverLocation.lng,
          speed: 0,
          lastUpdate: driverLocation.timestamp
            ? new Date(driverLocation.timestamp * 1000).toISOString()
            : null,
          isActive: true,
        } : {
          name: driverName,
          lat: null,
          lng: null,
          speed: 0,
          lastUpdate: null,
          isActive: false,
        },
        route: routeSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
