import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY")!;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const DEFAULT_RECIPIENT = "Jmagner@paccenergy.com";

function b64url(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

function buildMime(opts: { to: string; subject: string; html: string; text: string }) {
  const boundary = `bnd_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return `${headers}\r\n\r\n${body}`;
}

/** Sydney-local date window (returns UTC ISO strings for start & end-exclusive). */
function sydneyWindow(period: "daily" | "weekly"): { startISO: string; endISO: string; label: string; rangeLabel: string } {
  // Sydney offset: AEST UTC+10 (Apr–Oct), AEDT UTC+11 (Oct–Apr). Use Intl to be safe.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const sydY = Number(get("year"));
  const sydM = Number(get("month"));
  const sydD = Number(get("day"));

  // Anchor "today 6pm Sydney" so the daily report covers the day just ending.
  // For daily: window = [today 00:00 Sydney, today 18:00 Sydney) approx → just use "today" full day so far.
  // Simpler: report on the calendar day that just ended at 6pm — i.e. today's stats so far (since 00:00 Sydney).
  // For weekly (Friday 6pm): window = last 7 days ending now.

  const sydneyMidnightUTC = (y: number, m: number, d: number) => {
    // Build a UTC instant equal to Sydney midnight on (y,m,d) by probing offset.
    const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const sParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(guess);
    const sh = Number(sParts.find((p) => p.type === "hour")!.value);
    // Sydney is UTC+10 or +11. If hour is 10 or 11, we are at Sydney midnight + that offset earlier.
    // We want UTC such that Sydney shows 00:00. Offset = -sh hours from guess.
    return new Date(guess.getTime() - sh * 3600_000);
  };

  const todayStart = sydneyMidnightUTC(sydY, sydM, sydD);
  const now = new Date();

  if (period === "daily") {
    const dateLabel = `${sydD.toString().padStart(2, "0")}/${sydM.toString().padStart(2, "0")}/${sydY}`;
    return {
      startISO: todayStart.toISOString(),
      endISO: now.toISOString(),
      label: "Daily",
      rangeLabel: dateLabel,
    };
  }
  // weekly: last 7 days (including today so far)
  const weekStart = new Date(todayStart.getTime() - 6 * 86400_000);
  return {
    startISO: weekStart.toISOString(),
    endISO: now.toISOString(),
    label: "Weekly",
    rangeLabel: `Last 7 days ending ${sydD.toString().padStart(2, "0")}/${sydM.toString().padStart(2, "0")}/${sydY}`,
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtMoney(n: number) {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n: number, digits = 0) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtHours(ms: number) {
  const h = ms / 3_600_000;
  return `${h.toFixed(1)}h`;
}

async function buildReport(period: "daily" | "weekly") {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const win = sydneyWindow(period);

  // Transactions (sales / revenue / litres)
  const { data: txs = [] } = await admin
    .from("transactions")
    .select("cantidad, dinero_total, ppu, fecha")
    .gte("fecha", win.startISO)
    .lt("fecha", win.endISO);

  const litres = (txs ?? []).reduce((s: number, t: any) => s + (Number(t.cantidad) || 0), 0);
  const revenue = (txs ?? []).reduce((s: number, t: any) => {
    if (t.dinero_total && t.dinero_total > 0) return s + Number(t.dinero_total);
    if (t.ppu && t.cantidad) return s + Number(t.ppu) * Number(t.cantidad);
    return s;
  }, 0);
  const salesCount = (txs ?? []).length;

  // Latest buy price (ex GST) for profit estimate
  const { data: bp } = await admin
    .from("buy_prices")
    .select("price_per_litre")
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const buyExGst = Number(bp?.price_per_litre || 0);
  // revenue is typically inc GST → convert to ex GST for profit
  const revenueExGst = revenue / 1.1;
  const cogs = litres * buyExGst;
  const profit = revenueExGst - cogs;

  // Dispatch stops
  const { data: stops = [] } = await admin
    .from("dispatch_stops")
    .select("id, truck_id, driver_user_id, latitude, longitude, completed_at, status, sequence, scheduled_date")
    .gte("completed_at", win.startISO)
    .lt("completed_at", win.endISO)
    .eq("status", "completed");

  const stopsCount = (stops ?? []).length;

  // KMs per truck per scheduled_date — sum haversine distances between consecutive completed stops
  const byTruckDay = new Map<string, any[]>();
  for (const s of stops ?? []) {
    if (!s.truck_id || s.latitude == null || s.longitude == null) continue;
    const key = `${s.truck_id}|${s.scheduled_date}`;
    if (!byTruckDay.has(key)) byTruckDay.set(key, []);
    byTruckDay.get(key)!.push(s);
  }
  let kms = 0;
  for (const arr of byTruckDay.values()) {
    arr.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
    for (let i = 1; i < arr.length; i++) {
      kms += haversineKm(
        { lat: Number(arr[i - 1].latitude), lng: Number(arr[i - 1].longitude) },
        { lat: Number(arr[i].latitude), lng: Number(arr[i].longitude) },
      );
    }
  }

  // Driver hours — span of first→last completed_at per driver per day
  const byDriverDay = new Map<string, { min: number; max: number }>();
  for (const s of stops ?? []) {
    if (!s.driver_user_id || !s.completed_at) continue;
    const t = new Date(s.completed_at).getTime();
    const key = `${s.driver_user_id}|${s.scheduled_date}`;
    const cur = byDriverDay.get(key);
    if (!cur) byDriverDay.set(key, { min: t, max: t });
    else { cur.min = Math.min(cur.min, t); cur.max = Math.max(cur.max, t); }
  }
  let driverHoursMs = 0;
  for (const v of byDriverDay.values()) driverHoursMs += v.max - v.min;
  const driverDayCount = byDriverDay.size;

  return {
    win,
    metrics: {
      salesCount,
      litres,
      revenue,
      revenueExGst,
      cogs,
      profit,
      stopsCount,
      kms,
      driverHoursMs,
      driverDayCount,
    },
  };
}

function renderHtml(r: Awaited<ReturnType<typeof buildReport>>) {
  const m = r.metrics;
  // PACC ENERGY brand palette — sampled from the official brand book:
  //   deep olive-black, lime accent, bone background. Brutalist typography:
  //   massive uppercase wordmark stacked, generous negative space, no rounded corners.
  const FOREST = "#1b2a10";   // primary dark (almost black-green)
  const LIME   = "#c5f08c";   // signature accent
  const BONE   = "#ddd2bd";   // warm beige page bg
  const BONE_SOFT = "#e8dfcc";
  const INK    = "#1b2a10";
  const INK_SOFT = "#5a6447";
  const HAIRLINE = "#c4b89f";

  const row = (label: string, value: string, sub?: string) => `
    <tr>
      <td style="padding:20px 24px;border-top:1px solid ${HAIRLINE};color:${INK_SOFT};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;vertical-align:middle;">${label}</td>
      <td style="padding:20px 24px;border-top:1px solid ${HAIRLINE};color:${FOREST};font-size:26px;font-weight:900;text-align:right;line-height:1.1;letter-spacing:-0.5px;vertical-align:middle;">
        ${value}${sub ? `<div style="font-size:10px;font-weight:600;color:${INK_SOFT};margin-top:6px;letter-spacing:1.5px;text-transform:uppercase;">${sub}</div>` : ""}
      </td>
    </tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:${BONE};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">
  <div style="max-width:620px;margin:0 auto;">

    <!-- HERO: dark forest panel with massive stacked wordmark, lime "PACC ENERGY" -->
    <div style="background:${FOREST};padding:56px 32px 48px;">
      <div style="color:${LIME};font-size:64px;font-weight:900;letter-spacing:-2px;line-height:0.92;text-transform:uppercase;">PACC</div>
      <div style="color:${LIME};font-size:64px;font-weight:900;letter-spacing:-2px;line-height:0.92;text-transform:uppercase;margin-top:4px;">ENERGY</div>
      <div style="color:${LIME};opacity:0.7;font-size:10px;font-weight:700;letter-spacing:3px;margin-top:24px;text-transform:uppercase;">Powered&nbsp;&nbsp;By&nbsp;&nbsp;Progress</div>
    </div>

    <!-- Lime divider stripe -->
    <div style="background:${LIME};padding:14px 32px;color:${FOREST};font-size:11px;font-weight:900;letter-spacing:3px;text-transform:uppercase;">
      ${r.win.label}&nbsp;&nbsp;Operations&nbsp;&nbsp;Report
    </div>

    <!-- Date band on bone -->
    <div style="background:${BONE_SOFT};padding:24px 32px;border-bottom:1px solid ${HAIRLINE};">
      <div style="color:${INK_SOFT};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Reporting&nbsp;Window</div>
      <div style="color:${FOREST};font-size:22px;font-weight:900;margin-top:6px;letter-spacing:-0.5px;">${r.win.rangeLabel}</div>
    </div>

    <!-- Metrics table on bone -->
    <table role="presentation" style="width:100%;border-collapse:collapse;background:${BONE_SOFT};">
      ${row("Sales", fmtNum(m.salesCount), `${fmtNum(m.litres, 0)} L delivered`)}
      ${row("Revenue", fmtMoney(m.revenue), `Inc GST &nbsp;·&nbsp; ${fmtMoney(m.revenueExGst)} Ex GST`)}
      ${row("Gross Profit (est.)", fmtMoney(m.profit), `Ex GST &nbsp;·&nbsp; COGS ${fmtMoney(m.cogs)}`)}
      ${row("Stops Completed", fmtNum(m.stopsCount))}
      ${row("Kms Travelled (est.)", `${fmtNum(m.kms, 0)} km`, "Between completed stops")}
      ${row("Driver Hours", fmtHours(m.driverHoursMs), `${m.driverDayCount} Driver-Day${m.driverDayCount === 1 ? "" : "s"}`)}
    </table>

    <!-- Footer: dark forest with lime tagline -->
    <div style="background:${FOREST};padding:32px;text-align:center;">
      <div style="color:${LIME};font-size:11px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">"Fueling&nbsp;The&nbsp;Future"</div>
      <div style="color:${LIME};opacity:0.55;font-size:9px;font-weight:700;letter-spacing:2px;margin-top:14px;text-transform:uppercase;">Auto-sent&nbsp;·&nbsp;paccenergy.com</div>
    </div>

  </div>
</body></html>`;
}

function renderText(r: Awaited<ReturnType<typeof buildReport>>) {
  const m = r.metrics;
  return [
    `PACC Energy — ${r.win.label} Report`,
    r.win.rangeLabel,
    "",
    `Sales: ${m.salesCount} (${fmtNum(m.litres, 0)} L)`,
    `Revenue: ${fmtMoney(m.revenue)} inc GST (${fmtMoney(m.revenueExGst)} ex GST)`,
    `Gross profit (est.): ${fmtMoney(m.profit)} ex GST — COGS ${fmtMoney(m.cogs)}`,
    `Stops completed: ${m.stopsCount}`,
    `Kms travelled (est.): ${fmtNum(m.kms, 0)} km`,
    `Driver hours: ${fmtHours(m.driverHoursMs)} across ${m.driverDayCount} driver-day(s)`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let period = (url.searchParams.get("period") || "").toLowerCase();
    let recipient = url.searchParams.get("to") || "";
    if (req.method !== "GET") {
      try {
        const body = await req.json();
        if (body?.period) period = String(body.period).toLowerCase();
        if (body?.to) recipient = String(body.to);
      } catch (_) { /* no body */ }
    }
    if (period !== "daily" && period !== "weekly") period = "daily";
    if (!recipient) recipient = DEFAULT_RECIPIENT;

    const report = await buildReport(period as "daily" | "weekly");
    const html = renderHtml(report);
    const text = renderText(report);
    const subject = `PACC ${report.win.label} Report — ${report.win.rangeLabel}`;

    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      throw new Error("Email credentials not configured");
    }

    const mime = buildMime({ to: recipient, subject, html, text });
    const raw = b64url(mime);
    const resp = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error("Gmail send failed", resp.status, data);
      return new Response(JSON.stringify({ error: "Gmail send failed", details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, period, recipient, metrics: report.metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-ops-report error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});