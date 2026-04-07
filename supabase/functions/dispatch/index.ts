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
        const data = await orFetch("/create_order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "CREATE", orderNo: payload.order.orderNo, ...payload.order }),
        });
        return ok(data);
      }

      // ── Optimise / replan all routes ──
      case "optimise": {
        const date = payload?.date ?? new Date().toISOString().split("T")[0];
        const data = await orFetch("/plan_routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, planningMode: "REPLAN_ALL" }),
        });
        return ok(data);
      }

      // ── Reorder stops on a route ──
      case "reorder_stops": {
        if (!payload?.orders || !Array.isArray(payload.orders)) {
          return fail("Missing payload.orders array", 400);
        }
        const results = [];
        for (const order of payload.orders) {
          const data = await orFetch("/create_order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "UPDATE", ...order }),
          });
          results.push(data);
        }
        return ok(results);
      }

      // ── Delete orders ──
      case "delete_order": {
        if (!payload?.orderNos || !Array.isArray(payload.orderNos)) {
          return fail("Missing payload.orderNos array", 400);
        }
        const data = await orFetch("/delete_orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: payload.orderNos.map((no: string) => ({ orderNo: no })),
          }),
        });
        return ok(data);
      }

      // ── Get completion details for today's orders ──
      case "get_completions": {
        const date = payload?.date ?? new Date().toISOString().split("T")[0];
        const routes = await orFetch(`/get_routes?date=${date}`);
        const allOrderNos: string[] = [];
        for (const route of routes?.routes ?? []) {
          for (const stop of route?.stops ?? []) {
            if (stop.orderNo) allOrderNos.push(stop.orderNo);
          }
        }
        if (allOrderNos.length === 0) return ok({ orders: [] });

        const data = await orFetch("/get_completion_details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: allOrderNos.map((no) => ({ orderNo: no })),
          }),
        });
        return ok(data);
      }

      // ── Mark an order as complete ──
      case "mark_complete": {
        if (!payload?.orderNo) return fail("Missing payload.orderNo", 400);
        const data = await orFetch("/complete_order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNo: payload.orderNo,
            completionStatus: "success",
          }),
        });
        return ok(data);
      }

      default:
        return fail(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return fail(err.message);
  }
});
