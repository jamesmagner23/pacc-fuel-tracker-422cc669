import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const baseUrl = Deno.env.get("SCA_WEB_BASE_URL")!;
  const username = Deno.env.get("SCA_WEB_USERNAME")!;
  const password = Deno.env.get("SCA_WEB_PASSWORD")!;

  let totalFetched = 0;
  let totalUpserted = 0;

  const debugInfo: string[] = [];

  try {
    // Step 1: GET login page
    const loginPageRes = await fetch(`${baseUrl}/Account/LogOn`, { redirect: "manual" });
    debugInfo.push(`Login GET status: ${loginPageRes.status}`);
    const loginPageCookies = parseCookies(loginPageRes.headers);
    const loginPageBody = await loginPageRes.text();

    const csrfToken = loginPageBody.match(/name="__RequestVerificationToken".*?value="([^"]+)"/)?.[1] || "";
    debugInfo.push(`CSRF token found: ${csrfToken ? "yes" : "no"}, prefix: ${csrfToken.substring(0, 10)}`);

    // Step 2: POST login — DO NOT follow redirect
    const loginRes = await fetch(`${baseUrl}/Account/LogOn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieString(loginPageCookies),
      },
      body: new URLSearchParams({
        UserName: username,
        Password: password,
        __RequestVerificationToken: csrfToken,
        ReturnUrl: "/SCAWEB/Ventas/Lista",
      }).toString(),
      redirect: "manual",
    });
    debugInfo.push(`Login POST status: ${loginRes.status}`);

    // Capture Set-Cookie headers from the 302 response
    const setCookieRaw = loginRes.headers.get("set-cookie") || "(none)";
    debugInfo.push(`Login POST Set-Cookie: ${setCookieRaw}`);
    // Also try getSetCookie
    const setCookieArray = loginRes.headers.getSetCookie?.() || [];
    if (setCookieArray.length > 0) {
      debugInfo.push(`getSetCookie entries: ${setCookieArray.join(" | ")}`);
    }

    // Consume body to avoid leak
    await loginRes.text();

    // Step 3: Merge cookies
    const authCookies = { ...loginPageCookies, ...parseCookies(loginRes.headers) };

    if (loginRes.status !== 302) {
      const errMsg = `Login failed with status ${loginRes.status}. Debug: ${debugInfo.join(" ; ")}`;
      throw new Error(errMsg);
    }

    // Step 4: Determine start date
    const { data: latestTxn } = await supabase
      .from("transactions")
      .select("fecha")
      .order("fecha", { ascending: false })
      .limit(1)
      .single();

    const startDate = latestTxn
      ? latestTxn.fecha.split("T")[0]
      : getDateDaysAgo(60);

    const tomorrow = getTomorrow();

    // Step 5: Fetch all pages
    let page = 1;
    let allRecords: any[] = [];
    while (true) {
      const result = await fetchTransactions(baseUrl, authCookies, startDate, tomorrow, page);
      allRecords = allRecords.concat(result.Data || []);
      totalFetched = allRecords.length;

      if (allRecords.length >= (result.Total || 0)) break;
      page++;
    }
    debugInfo.push(`VentasList fetched ${totalFetched} records`);

    // Step 6: Upsert
    if (allRecords.length > 0) {
      const mapped = allRecords.map(mapRecord);
      for (let i = 0; i < mapped.length; i += 100) {
        const batch = mapped.slice(i, i + 100);
        const { error } = await supabase
          .from("transactions")
          .upsert(batch, { onConflict: "id" });
        if (error) {
          console.error("Upsert error for batch", i, error);
          throw new Error(`Upsert failed at batch ${i}: ${error.message}`);
        }
        totalUpserted += batch.length;
      }
    }

    // Log success
    await supabase.from("sync_log").insert({
      records_fetched: totalFetched,
      records_upserted: totalUpserted,
      status: "success",
    });

    return new Response(
      JSON.stringify({ success: true, records_fetched: totalFetched, records_upserted: totalUpserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Sync error:", err);
    await supabase.from("sync_log").insert({
      records_fetched: totalFetched,
      records_upserted: totalUpserted,
      status: "error",
      error_message: (err.message || String(err)).substring(0, 2000),
    });

    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseCookies(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {};
  // Try getSetCookie first (returns array of individual Set-Cookie values)
  const setCookieArray = headers.getSetCookie?.() || [];
  const raw = setCookieArray.length > 0
    ? setCookieArray
    : (headers.get("set-cookie") || "").split(/,(?=\s*[a-zA-Z_]+=)/);

  for (const c of raw) {
    const [nameVal] = c.split(";");
    const [name, ...val] = nameVal.trim().split("=");
    if (name) cookies[name.trim()] = val.join("=").trim();
  }
  return cookies;
}

function cookieString(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchTransactions(
  baseUrl: string,
  cookies: Record<string, string>,
  startDate: string,
  endDate: string,
  page: number
): Promise<any> {
  const body = new URLSearchParams({
    sort: "Fecha-desc",
    page: String(page),
    pageSize: "500",
    group: "",
    aggregate: "DineroTotal-sum~DineroFinanciacion-sum~Cantidad-sum~CantidadNeta-sum",
    filter: `Fecha~gte~datetime'${startDate}T00-00-00'~and~Fecha~lt~datetime'${endDate}T00-00-00'`,
  });

  const fetchWithRetry = async (attempt: number): Promise<Response> => {
    const res = await fetch(`${baseUrl}/Ventas/VentasList`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieString(cookies),
      },
      body: body.toString(),
    });
    if (!res.ok && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000));
      return fetchWithRetry(attempt + 1);
    }
    if (!res.ok) throw new Error(`VentasList failed: ${res.status} ${res.statusText}`);
    return res;
  };

  const res = await fetchWithRetry(1);
  return res.json();
}

function mapRecord(r: any) {
  const fecha = r.Fecha;
  const dateStr = fecha ? fecha.split("T")[0] : null;
  return {
    id: r.Id,
    fecha: r.Fecha,
    date: dateStr,
    estacion: r.Estacion,
    nombre_flota: r.NombreFlota,
    nombre_cliente1: r.NombreCliente1,
    identificador_cliente1: r.IdentificadorCliente1,
    ciudad: r.Ciudad,
    cantidad: r.Cantidad,
    cantidad_neta: r.CantidadNeta,
    producto: r.Producto,
    nombre_vendedor: r.NombreVendedor,
    placa: r.Placa,
    totalizador_bruto: r.TotalizadorBruto,
    factura: r.Factura,
    forma_de_pago: r.FormaDePago,
    ppu: r.Ppu,
    dinero_total: r.DineroTotal,
    surtidor: r.Surtidor,
    manguera: r.Manguera,
    region: r.Region,
    nombre_flota_doc: r.DocumentoFlota,
    documento_cliente1: r.DocumentoCliente1,
    nombre_vendedor_id: r.IdentificadorVendedor,
  };
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
