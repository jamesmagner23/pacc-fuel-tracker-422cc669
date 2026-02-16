const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const baseUrl = Deno.env.get("SCA_WEB_BASE_URL");
  const username = Deno.env.get("SCA_WEB_USERNAME");
  const password = Deno.env.get("SCA_WEB_PASSWORD");

  const debug: string[] = [];

  try {
    // Step 1: GET login page
    debug.push("Step 1: Fetching login page...");
    const loginPageRes = await fetch(`${baseUrl}/Account/LogOn?ReturnUrl=%2FSCAWEB%2FVentas%2FLista`, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36" },
    });
    debug.push(`Login page status: ${loginPageRes.status}`);

    // Get ALL headers for debugging
    const allHeaders: string[] = [];
    loginPageRes.headers.forEach((value, key) => {
      allHeaders.push(`${key}: ${value}`);
    });
    debug.push(`Login page response headers: ${allHeaders.join(" | ")}`);

    // Try both methods to get cookies
    let setCookieRaw = "";
    try {
      const arr = loginPageRes.headers.getSetCookie();
      setCookieRaw = arr.join(" ||| ");
      debug.push(`getSetCookie() returned ${arr.length} cookies: ${setCookieRaw}`);
    } catch {
      debug.push("getSetCookie() not available, using get()");
      setCookieRaw = loginPageRes.headers.get("set-cookie") || "NONE";
      debug.push(`get('set-cookie'): ${setCookieRaw}`);
    }

    // Parse cookies
    const cookies: Record<string, string> = {};
    try {
      const cookieHeaders = loginPageRes.headers.getSetCookie?.() || [loginPageRes.headers.get("set-cookie") || ""];
      for (const ch of cookieHeaders) {
        const [nameVal] = ch.split(";");
        const eqIdx = nameVal.indexOf("=");
        if (eqIdx > 0) {
          cookies[nameVal.substring(0, eqIdx).trim()] = nameVal.substring(eqIdx + 1).trim();
        }
      }
    } catch {}
    debug.push(`Parsed cookies: ${JSON.stringify(cookies)}`);

    // Extract CSRF token
    const loginPageBody = await loginPageRes.text();
    debug.push(`Login page body length: ${loginPageBody.length}`);

    const csrfMatch = loginPageBody.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || "";
    debug.push(`CSRF token found: ${!!csrfToken} (first 20 chars: ${csrfToken.substring(0, 20)})`);

    // Also check what input fields exist on the form
    const inputNames = [...loginPageBody.matchAll(/name="([^"]+)"/g)].map(m => m[1]);
    debug.push(`Form input names found: ${inputNames.join(", ")}`);

    // Check if username/password env vars are set
    debug.push(`Username set: ${!!username} (length: ${username?.length})`);
    debug.push(`Password set: ${!!password} (length: ${password?.length})`);

    // Step 2: POST login
    debug.push("Step 2: Posting login...");
    const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    debug.push(`Sending cookies: ${cookieStr}`);

    const formBody = new URLSearchParams({
      UserName: username || "",
      Password: password || "",
      __RequestVerificationToken: csrfToken,
      ReturnUrl: "/SCAWEB/Ventas/Lista",
    }).toString();
    debug.push(`POST body (password hidden): UserName=${username}&Password=***&__RequestVerificationToken=${csrfToken.substring(0, 10)}...&ReturnUrl=/SCAWEB/Ventas/Lista`);

    const loginRes = await fetch(`${baseUrl}/Account/LogOn?ReturnUrl=%2FSCAWEB%2FVentas%2FLista`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookieStr,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      },
      body: formBody,
      redirect: "manual",
    });

    debug.push(`Login POST status: ${loginRes.status} (302=success, 200=failed)`);

    // Get response headers
    const postHeaders: string[] = [];
    loginRes.headers.forEach((value, key) => {
      postHeaders.push(`${key}: ${value}`);
    });
    debug.push(`Login POST response headers: ${postHeaders.join(" | ")}`);

    // Get cookies from POST response
    try {
      const postCookies = loginRes.headers.getSetCookie();
      debug.push(`Login POST cookies (${postCookies.length}): ${postCookies.join(" ||| ")}`);
    } catch {
      debug.push(`Login POST set-cookie: ${loginRes.headers.get("set-cookie") || "NONE"}`);
    }

    // If 200, the login page was returned again (failure) — check for error messages
    if (loginRes.status === 200) {
      const failBody = await loginRes.text();
      const errorMatch = failBody.match(/validation-summary[^>]*>([\s\S]*?)<\/div/);
      debug.push(`Login error message: ${errorMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "none found"}`);
      debug.push(`Failed response body (first 500 chars): ${failBody.substring(0, 500)}`);
    }

    return new Response(JSON.stringify({ success: true, debug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    debug.push(`EXCEPTION: ${err.message}`);
    return new Response(JSON.stringify({ success: false, debug, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
