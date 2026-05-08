import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Suppliers we look for. Tweak the `query` to match the real sender / subject.
const SUPPLIERS: { name: string; query: string }[] = [
  { name: "Pacific", query: "from:(pacific) (price OR pricing OR rack) newer_than:2d" },
  { name: "Pro Fusion", query: "from:(profusion OR \"pro fusion\") (price OR pricing OR rack) newer_than:2d" },
];

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

  for (const sup of SUPPLIERS) {
    try {
      const listResp = await fetch(`${GATEWAY_URL}/users/me/messages?maxResults=5&q=${encodeURIComponent(sup.query)}`, {
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY },
      });
      const listData = await listResp.json();
      const messages = listData.messages || [];
      if (!messages.length) {
        await admin.from("supplier_price_scrape_log").insert({
          supplier: sup.name, status: "no_email", error: "No matching messages",
        });
        results.push({ supplier: sup.name, status: "no_email" });
        continue;
      }

      const msgId = messages[0].id;
      const msgResp = await fetch(`${GATEWAY_URL}/users/me/messages/${msgId}?format=full`, {
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY },
      });
      const msg = await msgResp.json();
      const body = extractPlainText(msg.payload);

      const { price, date, reason } = await aiExtractPrice(sup.name, body);
      if (price == null || price <= 0) {
        await admin.from("supplier_price_scrape_log").insert({
          supplier: sup.name, status: "parse_failed", gmail_message_id: msgId,
          raw_excerpt: body.slice(0, 500), error: reason,
        });
        results.push({ supplier: sup.name, status: "parse_failed", reason });
        continue;
      }

      const priceDate = date || today;
      await admin.from("buy_prices").upsert(
        { supplier: sup.name, price_per_litre: price, price_date: priceDate, notes: `Auto-scraped from Gmail (${reason || "ok"})` },
        { onConflict: "price_date,supplier" },
      );
      await admin.from("supplier_price_scrape_log").insert({
        supplier: sup.name, status: "success", price_per_litre: price, price_date: priceDate,
        gmail_message_id: msgId, raw_excerpt: body.slice(0, 500),
      });
      results.push({ supplier: sup.name, status: "success", price, priceDate });
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