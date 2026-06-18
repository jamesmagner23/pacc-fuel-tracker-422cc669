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

    const systemPrompt = `You are a fuel-invoice extraction expert. The user uploads a competitor's fuel invoice (PDF or image) that a prospective customer is currently paying. Extract structured data. All prices in Australian dollars. If a value is not visible, return null — do NOT guess. Return ONLY JSON conforming to the provided schema.`;

    const userContent: any[] = [
      {
        type: 'text',
        text: `Extract these fields from the attached fuel invoice (${filename ?? 'file'}):
- supplier_name: company billing the customer
- invoice_date: ISO date YYYY-MM-DD
- customer_name: who is being billed
- customer_address: full delivery / billing address
- fuel_type: e.g. "Diesel", "ULP", "Premium Diesel"
- litres: total litres delivered (number)
- price_per_litre_ex_gst: $/L excluding GST (number, e.g. 1.7234). If only inc-GST shown, divide by 1.1.
- price_per_litre_inc_gst: $/L including GST (number)
- delivery_fee_ex_gst: cartage / delivery fee in $ ex GST (number, 0 if none shown)
- subtotal_ex_gst: subtotal before GST
- gst_amount: GST amount in $
- total_inc_gst: invoice grand total in $
- notes: anything else relevant (rebates, surcharges, terms)

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