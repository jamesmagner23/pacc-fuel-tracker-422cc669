// Public click-tracker for email CTAs.
// Logs the click then 302-redirects to the destination URL.
// GET /functions/v1/track-email-click?cta=tour&campaign=portal-showcase&to=https%3A%2F%2F...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ALLOWED_PROTOCOLS = ["https:", "http:", "tel:", "mailto:"];
const FALLBACK_URL = "https://paccenergy.com";
const PORTAL_SHOWCASE_DEMO_URL =
  "https://paccenergy.com/portal?demo=true&brand=pacc&source=email";

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const buf = new TextEncoder().encode(`pacc-cta-salt:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isSafeRedirect(raw: string): boolean {
  try {
    const u = new URL(raw);
    return ALLOWED_PROTOCOLS.includes(u.protocol);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const cta = (url.searchParams.get("cta") || "").slice(0, 64) || "unknown";
  const campaign =
    (url.searchParams.get("campaign") || "").slice(0, 64) || "unknown";
  const rawTo = url.searchParams.get("to") || "";
  const trackedDestination = isSafeRedirect(rawTo) ? rawTo : FALLBACK_URL;
  const destination =
    campaign === "portal-showcase" && (cta.startsWith("tour") || rawTo.includes("paccenergy.com/portal"))
      ? PORTAL_SHOWCASE_DEMO_URL
      : trackedDestination;

  // Fire-and-log: never let a logging failure block the redirect.
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    await supabase.from("email_cta_clicks").insert({
      cta_id: cta,
      campaign,
      destination,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
      referer: req.headers.get("referer")?.slice(0, 500) || null,
      ip_hash: await hashIp(ip),
    });
  } catch (err) {
    console.error("track-email-click insert failed", err);
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: destination,
      "Cache-Control": "no-store",
    },
  });
});