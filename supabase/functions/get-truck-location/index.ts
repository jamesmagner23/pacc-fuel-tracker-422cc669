import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPTIMOROUTE_KEY = Deno.env.get("OPTIMOROUTE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getMelbourneDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") {
      return numeric > 1e12 ? numeric : numeric * 1000;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function toIsoTimestamp(value: unknown): string | null {
  const ms = toTimestampMs(value);
  return ms ? new Date(ms).toISOString() : null;
}

function isSameMelbourneDay(value: unknown, dateKey: string) {
  const ms = toTimestampMs(value);
  if (!ms) return false;
  return getMelbourneDateKey(new Date(ms)) === dateKey;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const routeDate = getMelbourneDateKey();

    const [routeRes, eventsRes] = await Promise.all([
      fetch(`https://api.optimoroute.com/v1/get_routes?key=${OPTIMOROUTE_KEY}&date=${routeDate}`, {
        method: "GET",
      }),
      fetch(`https://api.optimoroute.com/v1/get_events?key=${OPTIMOROUTE_KEY}&after_tag=`, {
        method: "GET",
      }),
    ]);

    if (!routeRes.ok) {
      const body = await routeRes.text();
      throw new Error(`OptimoRoute get_routes error: ${routeRes.status} - ${body}`);
    }

    const routeData = await routeRes.json();
    const eventsData = eventsRes.ok ? await eventsRes.json() : null;

    const selectedRoute = routeData?.routes?.[0] ?? null;
    const routeStops = selectedRoute?.stops ?? [];
    const todayOrderNos = new Set(
      routeStops.map((stop: any) => stop.orderNo).filter(Boolean)
    );

    let routeSummary = null;
    let driverName = selectedRoute?.driverName || "Stephan";

    if (selectedRoute) {
      const completedOrders = new Set<string>();
      if (eventsData?.events) {
        for (const evt of eventsData.events) {
          if (
            evt.event === "success" &&
            evt.orderNo &&
            todayOrderNos.has(evt.orderNo) &&
            isSameMelbourneDay(evt.position?.timestamp ?? evt.timestamp, routeDate)
          ) {
            completedOrders.add(evt.orderNo);
          }
        }
      }

      routeSummary = {
        completed: routeStops.filter((stop: any) => completedOrders.has(stop.orderNo)).length,
        total: routeStops.length,
        stops: routeStops,
      };
    }

    let completionPosition: { lat: number; lng: number; timestamp: unknown } | null = null;
    if (todayOrderNos.size > 0) {
      try {
        const completionRes = await fetch(
          `https://api.optimoroute.com/v1/get_completion_details?key=${OPTIMOROUTE_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orders: Array.from(todayOrderNos).map((orderNo) => ({ orderNo })),
            }),
          }
        );

        if (completionRes.ok) {
          const completionData = await completionRes.json();
          let latestTime = 0;

          for (const order of completionData?.orders ?? []) {
            const pos = order.completionDetails?.endPosition || order.completionDetails?.startPosition;
            const ms = toTimestampMs(pos?.timestamp);
            if (
              pos?.latitude &&
              pos?.longitude &&
              ms &&
              isSameMelbourneDay(ms, routeDate) &&
              ms > latestTime
            ) {
              latestTime = ms;
              completionPosition = {
                lat: pos.latitude,
                lng: pos.longitude,
                timestamp: pos.timestamp,
              };
            }
          }
        }
      } catch {
        // Non-critical, continue with events fallback.
      }
    }

    let driverLocation: {
      lat: number;
      lng: number;
      timestamp: unknown;
      event: string;
    } | null = null;

    if (completionPosition) {
      driverLocation = {
        lat: completionPosition.lat,
        lng: completionPosition.lng,
        timestamp: completionPosition.timestamp,
        event: "completion",
      };
    }

    if (!driverLocation && eventsData?.events?.length > 0) {
      for (let i = eventsData.events.length - 1; i >= 0; i--) {
        const evt = eventsData.events[i];
        const timestamp = evt.position?.timestamp ?? evt.timestamp;
        const matchesTodayOrder = evt.orderNo && todayOrderNos.has(evt.orderNo);
        const matchesDriver = !evt.driverName || evt.driverName === driverName;

        if (
          evt.position?.latitude &&
          evt.position?.longitude &&
          matchesTodayOrder &&
          matchesDriver &&
          isSameMelbourneDay(timestamp, routeDate)
        ) {
          driverLocation = {
            lat: evt.position.latitude,
            lng: evt.position.longitude,
            timestamp,
            event: evt.event,
          };
          if (evt.driverName) driverName = evt.driverName;
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        driver: driverLocation
          ? {
              name: driverName,
              lat: driverLocation.lat,
              lng: driverLocation.lng,
              speed: 0,
              lastUpdate: toIsoTimestamp(driverLocation.timestamp),
              isActive: true,
            }
          : {
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
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
