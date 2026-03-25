import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPTIMOROUTE_KEY = Deno.env.get("OPTIMOROUTE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get live driver locations from OptimoRoute
    const locRes = await fetch(`https://api.optimoroute.com/v1/get_driver_locations?key=${OPTIMOROUTE_KEY}`, {
      method: "GET",
    });

    if (!locRes.ok) {
      throw new Error(`OptimoRoute error: ${locRes.status}`);
    }

    const locData = await locRes.json();

    // Get today's routes for stop completion status
    const today = new Date().toISOString().split("T")[0];
    const routeRes = await fetch(`https://api.optimoroute.com/v1/get_routes?key=${OPTIMOROUTE_KEY}&date=${today}`, {
      method: "GET",
    });

    const routeData = routeRes.ok ? await routeRes.json() : null;

    // Extract first driver location (Stephan — only one driver for now)
    const drivers = locData?.drivers || [];
    const driver = drivers[0] || null;

    // Extract route summary
    let routeSummary = null;
    if (routeData?.routes?.length > 0) {
      const route = routeData.routes[0];
      const stops = route.stops || [];
      const completed = stops.filter((s: any) => s.status === "success").length;
      const total = stops.length;
      routeSummary = { completed, total, stops };
    }

    return new Response(
      JSON.stringify({
        success: true,
        driver: driver
          ? {
              name: driver.driverName || "Stephan",
              lat: driver.lat,
              lng: driver.lon,
              speed: driver.speed || 0,
              lastUpdate: driver.lastLocationUpdate,
              isActive: !!driver.lat,
            }
          : null,
        route: routeSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
