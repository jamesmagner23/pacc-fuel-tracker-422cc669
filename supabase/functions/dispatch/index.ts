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
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}key=${OPTIMOROUTE_KEY}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OptimoRoute ${path} ${res.status}: ${body}`);
  }
  return res.json();
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

        // Build OptimoRoute-compliant payload
        const body: Record<string, unknown> = {
          operation: o.operation || "CREATE",
          orderNo: o.orderNo,
          type: o.type || "D",
          date: o.date,
          duration: o.duration ?? 5,
        };

        // Location object – use locationName (not name)
        if (o.location) {
          const loc: Record<string, unknown> = {};
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

        // Optional fields
        if (o.twFrom) body.twFrom = o.twFrom;
        if (o.twTo) body.twTo = o.twTo;
        if (o.priority) {
          // Map long names to OptimoRoute codes
          const pMap: Record<string, string> = { low: "L", medium: "M", high: "H", critical: "C" };
          body.priority = pMap[o.priority.toLowerCase()] || o.priority;
        }
        if (o.notes) body.notes = o.notes;
        if (o.load1 != null) body.load1 = o.load1;
        if (o.assignedTo) body.assignedTo = o.assignedTo;
        if (o.acceptDuplicateOrderNo != null) body.acceptDuplicateOrderNo = o.acceptDuplicateOrderNo;

        const data = await orFetch("/create_order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return ok(data);
      }

      // ── Optimise / plan all routes ──
      case "optimise": {
        const date = payload?.date ?? new Date().toISOString().split("T")[0];
        const data = await orFetch("/start_planning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            startWith: payload?.startWith || "CURRENT",
            lockType: payload?.lockType || "NONE",
          }),
        });
        return ok(data);
      }

      // ── Reorder stops on a route (re-create with UPDATE) ──
      case "reorder_stops": {
        if (!payload?.orders || !Array.isArray(payload.orders)) {
          return fail("Missing payload.orders array", 400);
        }
        const results = [];
        for (const order of payload.orders) {
          const body: Record<string, unknown> = {
            operation: "UPDATE",
            orderNo: order.orderNo,
          };
          if (order.sequence != null) body.sequence = order.sequence;
          if (order.date) body.date = order.date;

          const data = await orFetch("/create_order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          results.push(data);
        }
        return ok(results);
      }

      // ── Delete orders (one at a time per API spec) ──
      case "delete_order": {
        if (!payload?.orderNos || !Array.isArray(payload.orderNos)) {
          return fail("Missing payload.orderNos array", 400);
        }
        const results = [];
        for (const no of payload.orderNos) {
          const data = await orFetch("/delete_order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderNo: no }),
          });
          results.push(data);
        }
        return ok(results);
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

      default:
        return fail(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return fail(err.message);
  }
});
