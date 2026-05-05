import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * POST { imageUrl: string }
 *  → { hex: "#RRGGBB" }
 *
 * Uses Lovable AI (Gemini Flash, vision) to identify the dominant brand
 * color of a logo. We ask only for a hex string to keep parsing trivial.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You identify a brand's primary accent color from its logo. Pick a saturated, recognizable hue (avoid white, black, or near-greys unless the logo is monochrome). Return ONLY a single 6-digit hex code prefixed with #, no other text.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "What is the primary brand color of this logo?" },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
        }),
      },
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429 || aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              aiResp.status === 429
                ? "Rate limit hit, try again in a moment."
                : "AI credits exhausted — top up in Workspace settings.",
          }),
          {
            status: aiResp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const raw: string = data?.choices?.[0]?.message?.content || "";
    const match = raw.match(/#([0-9a-fA-F]{6})/);
    const hex = match ? `#${match[1].toUpperCase()}` : null;
    if (!hex) {
      return new Response(
        JSON.stringify({ error: "Could not detect a color", raw }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ hex }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-brand-color error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});