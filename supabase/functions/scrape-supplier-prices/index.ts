import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Suppliers we look for. Tweak the `query` to match the real sender / subject.
const SUPPLIERS: { name: string; from: string }[] = [
  { name: "Pacific", from: "admin@pacificfuelsolutions.com.au" },
  { name: "Pro Fusion", from: "tony@profusionfuels.com.au" },
];

function buildQuery(from: string, supplier: string, windowExpr: string): string {
  // Exclude Pro Fusion "minus 1" / "minus1" pricing (lower-grade, not used).
  const exclude = supplier === "Pro Fusion"
    ? ' -subject:"minus 1" -subject:minus1 -subject:"-1"'
    : "";
  return `from:${from}${exclude} ${windowExpr}`;
}

function decodeBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function extractPlainText(payload: any): string {
  if (!payload) return "";
  const parts: string[] = [];
  const walk = (p: any) => {
    if (!p) return;
    if (p.body?.data) {
      const text = decodeBase64Url(p.body.data);
      if (p.mimeType === "text/plain" || p.mimeType === "text/html") parts.push(text);
    }
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  };
  walk(payload);
  return parts.join("\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);
}

async function aiExtractPrice(supplier: string, body: string): Promise<{ price: number | null; date: string | null; reason: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { price: null, date: null, reason: "No LOVABLE_API_KEY" };

  const prompt = `Extract the diesel buy price (per litre, EX-GST, in AUD) that ${supplier} is charging today from this email.
Return strict JSON: {"price_per_litre_ex_gst": number|null, "price_date": "YYYY-MM-DD"|null, "reason": string}.
If multiple products, prefer Diesel. If only inc-GST is shown, divide by 1.1 to convert. If unsure, return null.

EMAIL BODY:
${body}`;

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) return { price: null, date: null, reason: `AI ${resp.status}` };
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content);
    return {
      price: typeof parsed.price_per_litre_ex_gst === "number" ? parsed.price_per_litre_ex_gst : null,
      date: parsed.price_date || null,
      reason: parsed.reason || "",
    };
  } catch {
    return { price: null, date: null, reason: "JSON parse failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results: any[] = [];

  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing keys" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Backfill mode: process every matching email in the lookback window,
  // not just the latest. Triggered via { backfill: true } in body or ?backfill=1.
  let backfill = false;
  let lookbackDays = 2;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("backfill")) backfill = true;
    const lb = url.searchParams.get("days");
    if (lb) lookbackDays = Math.max(1, Math.min(1095, Number(lb)));
  } catch { /* ignore */ }
  if (req.method === "POST") {
    try {
      const j = await req.clone().json();
      if (j?.backfill) backfill = true;
      if (j?.days) lookbackDays = Math.max(1, Math.min(1095, Number(j.days)));
    } catch { /* no body */ }
  }
  if (backfill && lookbackDays < 30) lookbackDays = 365;
  const windowExpr = `newer_than:${lookbackDays}d`;

  for (const sup of SUPPLIERS) {
    try {
      const q = buildQuery(sup.from, sup.name, windowExpr);
      // Page through results (Gmail caps at 100/page).
      const messages: { id: string }[] = [];
      let pageToken: string | undefined = undefined;
      const maxPages = backfill ? 20 : 1;
      for (let p = 0; p < maxPages; p++) {
        const url = `${GATEWAY_URL}/users/me/messages?maxResults=${backfill ? 100 : 10}&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ""}`;
        const listResp = await fetch(url, {
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY },
        });
        const listData = await listResp.json();
        const batch = listData.messages || [];
        messages.push(...batch);
        pageToken = listData.nextPageToken;
        if (!pageToken) break;
      }
      if (!messages.length) {
        await admin.from("supplier_price_scrape_log").insert({
          supplier: sup.name, status: "no_email", error: "No matching messages",
        });
        results.push({ supplier: sup.name, status: "no_email" });
        continue;
      }

      // Fetch metadata for all candidates.
      const metas = await Promise.all(
        messages.map(async (m: any) => {
          const r = await fetch(`${GATEWAY_URL}/users/me/messages/${m.id}?format=metadata&metadataHeaders=Date&metadataHeaders=Subject`, {
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY },
          });
          const j = await r.json().catch(() => ({}));
          const subject = (j.payload?.headers || []).find((h: any) => h.name?.toLowerCase() === "subject")?.value || "";
          return { id: m.id as string, internalDate: Number(j.internalDate || 0), subject };
        }),
      );
      // Safety net: exclude Pro Fusion "minus 1" / "-1" emails even if Gmail query missed them
      const filtered = sup.name === "Pro Fusion"
        ? metas.filter((m) => !/minus\s*1/i.test(m.subject) && !/-\s*1\b/i.test(m.subject))
        : metas;
      if (!filtered.length) {
        await admin.from("supplier_price_scrape_log").insert({
          supplier: sup.name, status: "no_email", error: "All candidates filtered (e.g. minus1)",
        });
        results.push({ supplier: sup.name, status: "no_email" });
        continue;
      }
      filtered.sort((a, b) => b.internalDate - a.internalDate);

      // In backfill mode iterate all; in normal mode just the latest.
      const toProcess = backfill ? filtered : [filtered[0]];
      for (const cand of toProcess) {
        const latest = cand;
        const msgId = cand.id;

      // Skip if we've already successfully ingested this exact message
      const { data: prior } = await admin
        .from("supplier_price_scrape_log")
        .select("id, gmail_message_id, scraped_at")
        .eq("supplier", sup.name)
        .eq("status", "success")
        .eq("gmail_message_id", msgId)
        .limit(1);
      if (prior && prior.length) {
        if (!backfill) {
          await admin.from("supplier_price_scrape_log").insert({
            supplier: sup.name, status: "skipped_duplicate", gmail_message_id: msgId,
            error: "Already ingested this Gmail message",
          });
          results.push({ supplier: sup.name, status: "skipped_duplicate", msgId });
        }
        continue;
      }

      const msgResp = await fetch(`${GATEWAY_URL}/users/me/messages/${msgId}?format=full`, {
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY },
      });
      const msg = await msgResp.json();
      const body = extractPlainText(msg.payload);
      const emailEpochMs = Number(msg.internalDate || latest.internalDate || 0);

      const { price, date, reason } = await aiExtractPrice(sup.name, body);
      if (price == null || price <= 0) {
        await admin.from("supplier_price_scrape_log").insert({
          supplier: sup.name, status: "parse_failed", gmail_message_id: msgId,
          raw_excerpt: body.slice(0, 500), error: reason,
        });
        results.push({ supplier: sup.name, status: "parse_failed", reason });
        continue;
      }

      // Prefer AI-extracted date; fall back to email's send date (in backfill, NEVER `today`).
      const emailDate = emailEpochMs ? new Date(emailEpochMs).toISOString().slice(0, 10) : today;
      const priceDate = date || emailDate;

      // Only overwrite the buy price if this email is newer than the email
      // that produced the currently-stored price for this (supplier, price_date).
      const { data: latestSuccess } = await admin
        .from("supplier_price_scrape_log")
        .select("gmail_message_id, scraped_at")
        .eq("supplier", sup.name)
        .eq("status", "success")
        .eq("price_date", priceDate)
        .order("scraped_at", { ascending: false })
        .limit(1);

      let shouldWrite = true;
      if (latestSuccess && latestSuccess.length && latestSuccess[0].gmail_message_id) {
        const prevId = latestSuccess[0].gmail_message_id;
        if (prevId === msgId) {
          shouldWrite = false;
        } else {
          // Compare by internalDate of the previously-ingested message
          const r = await fetch(`${GATEWAY_URL}/users/me/messages/${prevId}?format=metadata`, {
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY },
          });
          const prev = await r.json().catch(() => ({}));
          const prevEpoch = Number(prev.internalDate || 0);
          if (prevEpoch && emailEpochMs && emailEpochMs <= prevEpoch) {
            shouldWrite = false;
          }
        }
      }

      if (!shouldWrite) {
        await admin.from("supplier_price_scrape_log").insert({
          supplier: sup.name, status: "skipped_stale", price_per_litre: price, price_date: priceDate,
          gmail_message_id: msgId, raw_excerpt: body.slice(0, 500),
          error: "Newer or equal price already stored for this date",
        });
        results.push({ supplier: sup.name, status: "skipped_stale", price, priceDate });
        continue;
      }

      await admin.from("buy_prices").upsert(
        { supplier: sup.name, price_per_litre: price, price_date: priceDate, notes: `Auto-scraped from Gmail (${reason || "ok"})` },
        { onConflict: "price_date,supplier" },
      );
      await admin.from("supplier_price_scrape_log").insert({
        supplier: sup.name, status: "success", price_per_litre: price, price_date: priceDate,
        gmail_message_id: msgId, raw_excerpt: body.slice(0, 500),
      });
      results.push({ supplier: sup.name, status: "success", price, priceDate });
      } // end toProcess loop
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await admin.from("supplier_price_scrape_log").insert({
        supplier: sup.name, status: "error", error: msg,
      });
      results.push({ supplier: sup.name, status: "error", error: msg });
    }
  }

  // Recommend cheapest for today
  const { data: todays } = await admin
    .from("buy_prices").select("supplier, price_per_litre").eq("price_date", today)
    .order("price_per_litre", { ascending: true });

  return new Response(JSON.stringify({ ok: true, results, cheapest_today: todays?.[0] || null }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});