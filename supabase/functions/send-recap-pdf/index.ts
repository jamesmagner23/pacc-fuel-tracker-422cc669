import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

/** UTF-8 safe base64url. */
function b64url(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 2047 encoded-word for non-ASCII headers. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

/** Wrap a long base64 string at 76 chars (per RFC 2045). */
function chunk76(s: string) {
  return s.replace(/(.{76})/g, "$1\r\n");
}

function buildMimeWithPdf(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  pdfBase64: string;
  pdfFilename: string;
  bcc?: string;
}) {
  const altBoundary = `alt_${crypto.randomUUID().replace(/-/g, "")}`;
  const mixedBoundary = `mix_${crypto.randomUUID().replace(/-/g, "")}`;

  const headers = [
    `To: ${opts.to}`,
    opts.bcc ? `Bcc: ${opts.bcc}` : "",
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ].filter(Boolean).join("\r\n");

  const altPart = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.text || "",
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.html || "",
    `--${altBoundary}--`,
    "",
  ].join("\r\n");

  const body = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    altPart,
    `--${mixedBoundary}`,
    `Content-Type: application/pdf; name="${opts.pdfFilename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${opts.pdfFilename}"`,
    "",
    chunk76(opts.pdfBase64),
    `--${mixedBoundary}--`,
    "",
  ].join("\r\n");

  return `${headers}\r\n\r\n${body}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const recipients: string[] = Array.isArray(body?.recipients) ? body.recipients : [];
    const subject: string = (body?.subject ?? "").toString();
    const html: string = (body?.html ?? "").toString();
    const text: string = (body?.text ?? "").toString();
    const pdfBase64: string = (body?.pdfBase64 ?? "").toString();
    const pdfFilename: string = (body?.pdfFilename ?? "analytics-recap.pdf").toString();
    const bcc: string | undefined = body?.bcc ? body.bcc.toString() : undefined;

    // Validation
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleaned = recipients.map(r => r.trim()).filter(r => emailRe.test(r));
    if (cleaned.length === 0) {
      return new Response(JSON.stringify({ error: "At least one valid recipient is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cleaned.length > 50) {
      return new Response(JSON.stringify({ error: "Maximum 50 recipients per send" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!subject || subject.length > 200) {
      return new Response(JSON.stringify({ error: "Subject is required (max 200 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!pdfBase64 || pdfBase64.length < 100) {
      return new Response(JSON.stringify({ error: "Missing or invalid PDF payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ~7MB hard cap on raw base64 (≈5MB binary) to stay under Gmail's 25MB
    // ceiling once the MIME envelope is wrapped.
    if (pdfBase64.length > 7 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "PDF too large to email (max ~5MB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safeFilename = pdfFilename.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120) || "analytics-recap.pdf";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!GOOGLE_MAIL_API_KEY) throw new Error("GOOGLE_MAIL_API_KEY is not configured");

    // Send to all recipients in one MIME (To: comma-joined). Optional bcc.
    const to = cleaned.join(", ");
    const mime = buildMimeWithPdf({
      to, subject, html, text, pdfBase64, pdfFilename: safeFilename, bcc,
    });
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
      return new Response(JSON.stringify({
        error: "Gmail send failed", status: resp.status, details: data,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true, messageId: data.id, threadId: data.threadId, recipients: cleaned,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("send-recap-pdf error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});