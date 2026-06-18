import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing LOVABLE_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { file_base64, mime_type, filename } = body ?? {};
    if (!file_base64 || !mime_type) {
      return new Response(JSON.stringify({ error: 'file_base64 and mime_type required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPdf = mime_type === 'application/pdf';
    const dataUrl = `data:${mime_type};base64,${file_base64}`;

    const systemPrompt = `You are a fuel-invoice extraction expert for Australian fuel invoices (PDF or image). All amounts are AUD and GST is 10%.

CRITICAL RULES:
- READ THE DOCUMENT CAREFULLY. Numbers in tables are tabular — line them up with their column headers.
- If the unit price column says "Price (Inc GST)" or "Inc GST" the per-litre value shown is INC GST. Set price_per_litre_inc_gst to that number AND compute price_per_litre_ex_gst = inc / 1.1 (round to 4 decimals).
- If the column says "Ex GST" set price_per_litre_ex_gst directly and compute inc = ex * 1.1.
- If only the line total ("Extension"/"Amount") and litres are visible, derive price_per_litre_inc_gst = total_inc_gst / litres, then ex = inc / 1.1.
- supplier_name = the company issuing the invoice (top of doc / logo / "Tax Invoice from"). NOT the carrier, NOT the customer.
- customer_name = the "Invoice To" / "Bill To" party.
- litres are usually shown to 4 decimals (e.g. 2700.0000) — return as a plain number (2700).
- fuel_type: read the product line, e.g. "EXTRA LOW SULPHUR DIESEL", "ULP", "Premium Diesel".
- Never return 0 for a price that exists on the invoice. If you genuinely cannot read it, return null.
- Return ONLY valid JSON. No prose, no markdown.`;

    const userContent: any[] = [
      {
        type: 'text',
        text: `Extract these fields from the attached fuel invoice (${filename ?? 'file'}). Follow the CRITICAL RULES in the system prompt exactly — especially around inc/ex GST and reading tabular columns.

Fields:
- supplier_name (string): company issuing the invoice
- invoice_date (YYYY-MM-DD)
- customer_name (string): "Invoice To" party
- customer_address (string): full billing/delivery address
- fuel_type (string)
- litres (number)
- price_per_litre_ex_gst (number, 4dp). REQUIRED if any price is visible — derive from inc or total/litres if needed.
- price_per_litre_inc_gst (number, 4dp). REQUIRED if any price is visible.
- delivery_fee_ex_gst (number, 0 if none)
- subtotal_ex_gst (number)
- gst_amount (number)
- total_inc_gst (number) — the invoice grand total
- notes (string|null): rebates, surcharges, terms, anything else relevant

Worked example: column header "Price(Inc GST)" shows 1.8964, litres 2700, extension $5,120.28, GST included $465.48. Then:
  price_per_litre_inc_gst = 1.8964
  price_per_litre_ex_gst  = 1.8964 / 1.1 = 1.7240
  subtotal_ex_gst = 5120.28 - 465.48 = 4654.80
  gst_amount = 465.48
  total_inc_gst = 5120.28

Return JSON only.`,
      },
    ];

    if (isPdf) {
      userContent.push({
        type: 'file',
        file: { filename: filename ?? 'invoice.pdf', file_data: dataUrl },
      });
    } else {
      userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
    }

    const gatewayRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.error('Gateway error', gatewayRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'AI gateway error', status: gatewayRes.status, detail: errText }),
        { status: gatewayRes.status === 402 || gatewayRes.status === 429 ? gatewayRes.status : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const json = await gatewayRes.json();
    const content: string = json?.choices?.[0]?.message?.content ?? '{}';

    let extracted: any = {};
    try {
      extracted = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);
    }

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analyze-competitor-invoice error', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});