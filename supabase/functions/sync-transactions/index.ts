import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const loginPage = await fetch(`${baseUrl}/Account/LogOn?ReturnUrl=%2FSCAWEB%2FVentas%2FLista`, {
    redirect: "manual",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  await loginPage.text();

  const loginRes = await fetch(`${baseUrl}/Account/LogOn?ReturnUrl=%2FSCAWEB%2FVentas%2FLista`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body: new URLSearchParams({
      UserName: username,
      Password: password,
      ReturnUrl: "/SCAWEB/Ventas/Lista",
    }).toString(),
    redirect: "manual",
  });

  if (loginRes.status !== 302) {
    await loginRes.text();
    throw new Error(`Login failed with status ${loginRes.status}`);
  }

  const authCookies: string[] = [];
  for (const c of loginRes.headers.getSetCookie()) {
    authCookies.push(c.split(";")[0]);
  }
  await loginRes.text();
  return authCookies.join("; ");
}

interface SCARecord {
  Id: number;
  Fecha: string;
  Ciudad: string | null;
  Region: string | null;
  Estacion: string | null;
  IdSurtidor: number | null;
  Surtidor: string | null;
  Manguera: string | null;
  Producto: string | null;
  Factura: number | null;
  Placa: string | null;
  NombreFlota: string | null;
  DocumentoFlota: string | null;
  NombreApellidosCliente1: string | null;
  DocumentoCliente1: string | null;
  IdentificadorCliente1: string | null;
  FormaDePago: string | null;
  NombreApellidosVendedor: string | null;
  IdentificadorVendedor: string | null;
  TotalizadorBruto: number | null;
  Cantidad: number | null;
  CantidadNeta: number | null;
  Ppu: number | null;
  DineroTotal: number | null;
}

function mapToRow(r: SCARecord) {
  const fechaDate = r.Fecha ? r.Fecha.split("T")[0] : null;
  return {
    id: r.Id,
    fecha: r.Fecha,
    date: fechaDate,
    ciudad: r.Ciudad,
    region: r.Region,
    estacion: r.Estacion,
    id_surtidor: r.IdSurtidor,
    surtidor: r.Surtidor,
    manguera: r.Manguera,
    producto: r.Producto,
    factura: r.Factura,
    placa: r.Placa,
    nombre_flota: r.NombreFlota,
    nombre_flota_doc: r.DocumentoFlota,
    nombre_cliente1: r.NombreApellidosCliente1,
    documento_cliente1: r.DocumentoCliente1,
    identificador_cliente1: r.IdentificadorCliente1,
    forma_de_pago: r.FormaDePago,
    nombre_vendedor: r.NombreApellidosVendedor,
    nombre_vendedor_id: r.IdentificadorVendedor,
    totalizador_bruto: r.TotalizadorBruto,
    cantidad: r.Cantidad,
    cantidad_neta: r.CantidadNeta,
    ppu: r.Ppu,
    dinero_total: r.DineroTotal,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // --- Authentication: require admin role ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userId = claimsData.claims.sub;

  // Check admin role
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: roleCheck } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (!roleCheck) {
    return new Response(
      JSON.stringify({ success: false, error: "Admin access required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // --- End authentication ---

  const baseUrl = Deno.env.get("SCA_WEB_BASE_URL")!;
  const username = Deno.env.get("SCA_WEB_USERNAME")!;
  const password = Deno.env.get("SCA_WEB_PASSWORD")!;

  let totalFetched = 0;
  let totalUpserted = 0;

  try {
    const cookieStr = await login(baseUrl, username, password);

    const pageSize = 200;
    let page = 1;
    let hasMore = true;
    const allRecords: ReturnType<typeof mapToRow>[] = [];

    while (hasMore) {
      const res = await fetch(`${baseUrl}/Ventas/VentasList?page=${page}&pageSize=${pageSize}`, {
        headers: {
          "Cookie": cookieStr,
          "User-Agent": "Mozilla/5.0",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (res.status !== 200) {
        await res.text();
        throw new Error(`VentasList returned status ${res.status} on page ${page}`);
      }

      const json = await res.json();
      const records: SCARecord[] = json.Data || [];
      const total: number = json.Total || 0;

      for (const r of records) {
        allRecords.push(mapToRow(r));
      }

      totalFetched += records.length;
      hasMore = totalFetched < total;
      page++;

      if (page > 100) break;
    }

    const batchSize = 500;
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      const { error } = await supabase
        .from("transactions")
        .upsert(batch, { onConflict: "id" });

      if (error) throw new Error(`Upsert error: ${error.message}`);
      totalUpserted += batch.length;
    }

    await supabase.from("sync_log").insert({
      status: "success",
      records_fetched: totalFetched,
      records_upserted: totalUpserted,
    });

    return new Response(
      JSON.stringify({ success: true, records_fetched: totalFetched, records_upserted: totalUpserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    await supabase.from("sync_log").insert({
      status: "error",
      records_fetched: totalFetched,
      records_upserted: totalUpserted,
      error_message: err.message,
    });

    return new Response(
      JSON.stringify({ success: false, error: "Sync failed", records_fetched: totalFetched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
