import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPTIMOROUTE_KEY = Deno.env.get("OPTIMOROUTE_API_KEY");
const BASE = "https://api.optimoroute.com/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function orFetch(path: string, init?: RequestInit) {
  if (!OPTIMOROUTE_KEY) {
    throw new Error("OPTIMOROUTE_API_KEY is not configured");
  }

  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}key=${OPTIMOROUTE_KEY}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OptimoRoute ${path} ${res.status}: ${body}`);
  }
  return res.json();
}

async function startPlanning(date: string, startWith = "CURRENT", lockType = "NONE") {
  return await orFetch("/start_planning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, startWith, lockType }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return fail("POST required", 405);
  }

  try {
    const { action, payload } = await req.json();

    if (!action) return fail("Missing action", 400);

    switch (action) {
      // ── Get schedule for a date ──
      case "get_schedule": {
        const date = payload?.date ?? new Date().toISOString().split("T")[0];
        const data = await orFetch(`/get_routes?date=${date}`);
        return ok(data);
      }

      // ── Create a new delivery order ──
      case "create_order": {
        if (!payload?.order) return fail("Missing payload.order", 400);
        const o = payload.order;
        const date = o.date ?? new Date().toISOString().split("T")[0];
        const derivedTimeWindow = o.timeWindow?.tw1;
        const parsedDuration = Number(o.duration);
        const parsedLoad1 = o.load1 != null ? Number(o.load1) : null;
        const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 && parsedDuration <= 480 ? parsedDuration : 30;

        const body: Record<string, unknown> = {
          operation: o.operation || "CREATE",
          orderNo: o.orderNo,
          type: o.type || "D",
          date,
          duration,
        };

        if (o.location) {
          const loc: Record<string, unknown> = {
            acceptPartialMatch: true,
            acceptMultipleResults: true,
          };
          if (o.location.address) loc.address = o.location.address;
          if (o.location.locationName || o.location.name) {
            loc.locationName = o.location.locationName || o.location.name;
          }
          if (o.location.locationNo) loc.locationNo = o.location.locationNo;
          if (o.location.latitude != null) loc.latitude = o.location.latitude;
          if (o.location.longitude != null) loc.longitude = o.location.longitude;
          if (o.location.acceptPartialMatch != null) loc.acceptPartialMatch = o.location.acceptPartialMatch;
          if (o.location.acceptMultipleResults != null) loc.acceptMultipleResults = o.location.acceptMultipleResults;
          body.location = loc;
        }

        if (o.twFrom || derivedTimeWindow?.timeFrom) body.twFrom = o.twFrom || derivedTimeWindow.timeFrom;
        if (o.twTo || derivedTimeWindow?.timeTo) body.twTo = o.twTo || derivedTimeWindow.timeTo;
        if (o.priority) {
          const pMap: Record<string, string> = { low: "L", medium: "M", high: "H", critical: "C" };
          body.priority = pMap[o.priority.toLowerCase()] || o.priority;
        }
        if (o.notes) body.notes = o.notes;
        if (parsedLoad1 != null && Number.isFinite(parsedLoad1) && parsedLoad1 > 0) {
          body.load1 = parsedLoad1;
        } else if (Number.isFinite(parsedDuration) && parsedDuration > 480) {
          body.load1 = parsedDuration;
        }
        if (o.assignedTo) body.assignedTo = o.assignedTo;
        if (o.acceptDuplicateOrderNo != null) body.acceptDuplicateOrderNo = o.acceptDuplicateOrderNo;

        const order = await orFetch("/create_order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        let planning: unknown = null;
        let planningError: string | null = null;

        try {
          planning = await startPlanning(date);
        } catch (error) {
          planningError = error instanceof Error ? error.message : "Unknown planning error";
        }

        return ok({ order, planning, planningError });
      }

      // ── Optimise / plan all routes ──
      case "optimise": {
        const date = payload?.date ?? new Date().toISOString().split("T")[0];
        const data = await startPlanning(
          date,
          payload?.startWith || "CURRENT",
          payload?.lockType || "NONE",
        );
        return ok(data);
      }

      // ── Reorder stops (optimistic UI + re-plan) ──
      // OptimoRoute doesn't support manual stop sequencing via API.
      // The planner determines the optimal order. We just trigger re-planning.
      case "reorder_stops": {
        if (!payload?.orders || !Array.isArray(payload.orders)) {
          return fail("Missing payload.orders array", 400);
        }
        const reorderDate = payload.date ?? new Date().toISOString().split("T")[0];

        // Trigger re-planning to optimise the route
        let planning: unknown = null;
        try {
          planning = await startPlanning(reorderDate, "CURRENT", "NONE");
        } catch (e) {
          // Planning may fail if already running
        }

        return ok({ planning });
      }

      // ── Delete orders (one at a time per API spec) ──
      case "delete_order": {
        if (!payload?.orderNos || !Array.isArray(payload.orderNos)) {
          return fail("Missing payload.orderNos array", 400);
        }
        const results = [];
        const errors: string[] = [];
        let deletedCount = 0;
        for (const no of payload.orderNos) {
          try {
            const data = await orFetch("/delete_order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderNo: no }),
            });

            results.push({ orderNo: no, ...data });

            if (data?.success === false) {
              errors.push(`${no}: ${data.message || "failed"}`);
            } else {
              deletedCount += 1;
            }
          } catch (error) {
            const rawMessage = error instanceof Error ? error.message : "Delete failed";
            const detail = rawMessage.split(": ").slice(1).join(": ") || rawMessage;

            let parsedMessage = detail;
            try {
              const parsed = JSON.parse(detail);
              parsedMessage = parsed?.message || parsed?.error || parsed?.code || detail;
            } catch {
              parsedMessage = detail;
            }

            errors.push(`${no}: ${parsedMessage}`);
            results.push({ orderNo: no, success: false, message: parsedMessage });
          }
        }

        const deleteDate = payload?.date ?? new Date().toISOString().split("T")[0];
        let planning: unknown = null;
        let planningError: string | null = null;

        if (deletedCount > 0) {
          try {
            planning = await startPlanning(deleteDate, "CURRENT", "NONE");
          } catch (error) {
            planningError = error instanceof Error ? error.message : "Unknown planning error";
          }
        }

        // Return success with detailed per-order outcomes so the UI can show the real message.
        return ok({ results, errors, deletedCount, planning, planningError });
      }

      // ── Get planning status ──
      case "get_planning_status": {
        if (!payload?.planningId) return fail("Missing payload.planningId", 400);
        const data = await orFetch(`/get_planning_status?planningId=${payload.planningId}`);
        return ok(data);
      }

      // ── Get scheduling info for a specific order ──
      case "get_scheduling_info": {
        if (!payload?.orderNo) return fail("Missing payload.orderNo", 400);
        const data = await orFetch(`/get_scheduling_info?orderNo=${encodeURIComponent(payload.orderNo)}`);
        return ok(data);
      }

      // ── Extract known locations from recent routes ──
      case "get_locations": {
        const date = payload?.date ?? new Date().toISOString().split("T")[0];
        const data = await orFetch(`/get_routes?date=${date}`);
        const locations: { locationName: string; address: string; locationNo?: string }[] = [];
        const seen = new Set<string>();
        for (const route of data?.routes ?? []) {
          for (const stop of route?.stops ?? []) {
            const key = `${stop.locationName || ""}|${stop.address || ""}`;
            if (key !== "|" && !seen.has(key)) {
              seen.add(key);
              locations.push({
                locationName: stop.locationName || "",
                address: stop.address || "",
                locationNo: stop.locationNo || undefined,
              });
            }
          }
        }
        return ok(locations);
      }

      // ── Analytics: aggregate route data across date range ──
      case "get_analytics": {
        const dates: string[] = payload?.dates ?? [];
        if (!dates.length) return fail("Missing payload.dates array", 400);

        const results = await Promise.all(
          dates.map(async (d: string) => {
            try {
              const data = await orFetch(`/get_routes?date=${d}`);
              const routes = data?.routes ?? [];
              let stops = 0;
              let completedStops = 0;
              let totalDistanceKm = 0;
              let totalDurationMin = 0;
              let totalLoad = 0;
              const drivers = new Set<string>();

              for (const route of routes) {
                const routeStops = route.stops?.length ?? 0;
                stops += routeStops;
                totalDistanceKm += route.distance ?? 0;
                totalDurationMin += route.duration ?? 0;
                if (route.driverName) drivers.add(route.driverName);
                for (const s of route.stops ?? []) {
                  if (s.status?.toLowerCase() === "completed") completedStops++;
                  totalLoad += s.load1 ?? 0;
                }
              }

              return {
                date: d,
                routes: routes.length,
                stops,
                completedStops,
                distanceKm: Math.round(totalDistanceKm * 10) / 10,
                durationMin: Math.round(totalDurationMin),
                drivers: drivers.size,
                driverNames: Array.from(drivers),
                totalLoad: Math.round(totalLoad),
              };
            } catch {
              return { date: d, routes: 0, stops: 0, completedStops: 0, distanceKm: 0, durationMin: 0, drivers: 0, driverNames: [], totalLoad: 0 };
            }
          })
        );

        return ok(results);
      }


        return fail(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return fail(err.message);
  }
});
