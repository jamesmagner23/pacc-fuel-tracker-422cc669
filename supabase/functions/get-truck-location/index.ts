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

    // 1. Get today's routes for stop data and driver info + events in parallel
    const routeRes = await fetch(
      `https://api.optimoroute.com/v1/get_routes?key=${OPTIMOROUTE_KEY}&date=${today}`,
      { method: "GET" }
    );

    if (!routeRes.ok) {
      const body = await routeRes.text();
      throw new Error(`OptimoRoute get_routes error: ${routeRes.status} - ${body}`);
    }

    const routeData = await routeRes.json();

    // 2. Get mobile events for GPS positions from order events
    const eventsRes = await fetch(
      `https://api.optimoroute.com/v1/get_events?key=${OPTIMOROUTE_KEY}&after_tag=`,
      { method: "GET" }
    );

    const eventsData = eventsRes.ok ? await eventsRes.json() : null;

    // 3. Get completion details for today's orders (has more accurate GPS)
    let completionPosition = null;
    let completionTimestamp = null;
    if (routeData?.routes?.length > 0) {
      const allOrderNos = routeData.routes[0].stops?.map((s: any) => s.orderNo).filter(Boolean) || [];
      if (allOrderNos.length > 0) {
        try {
          const completionRes = await fetch(
            `https://api.optimoroute.com/v1/get_completion_details?key=${OPTIMOROUTE_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orders: allOrderNos.map((no: string) => ({ orderNo: no })),
              }),
            }
          );
          if (completionRes.ok) {
            const completionData = await completionRes.json();
            // Find most recent completion with endPosition (GPS when driver finished)
            if (completionData?.orders) {
              let latestTime = 0;
              for (const order of completionData.orders) {
                const pos = order.completionDetails?.endPosition || order.completionDetails?.startPosition;
                if (pos?.latitude && pos?.longitude && pos?.timestamp) {
                  const t = new Date(pos.timestamp).getTime();
                  if (t > latestTime) {
                    latestTime = t;
                    completionPosition = { lat: pos.latitude, lng: pos.longitude };
                    completionTimestamp = pos.timestamp;
                  }
                }
              }
            }
          }
        } catch (e) {
          // Non-critical, fall back to events
        }
      }
    }

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

    // 4. Extract last known position - prefer completion details, then events, then stops
    let driverLocation = null;

    // Use completion details if available (most accurate)
    if (completionPosition) {
      driverLocation = {
        lat: completionPosition.lat,
        lng: completionPosition.lng,
        timestamp: completionTimestamp,
        event: "completion",
      };
    }

    // Fall back to events
    if (!driverLocation && eventsData?.events?.length > 0) {
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

    // 5. Fallback: use the last completed stop's location from the route
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
