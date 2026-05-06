-- Refresh outreach email templates with the new light theme HTML.
UPDATE public.email_templates SET html_body = $HTML$
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Daily diesel price — PACC Energy</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',Helvetica,Arial,sans-serif;color:#0E1F10;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Daily diesel price for {{customer_name}} — valid for {{validity}}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:0;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;">

        <!-- Header bar -->
        <tr><td style="background:#EFE9DC;padding:22px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle">
                <div style="line-height:1;">
                  <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;color:#0E1F10;letter-spacing:-0.03em;text-transform:uppercase;line-height:1;">
                    PACC<span style="color:#3F6B36;font-size:14px;">&reg;</span>
                  </div>
                  <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:8px;font-weight:500;color:#6B7565;letter-spacing:0.18em;margin-top:3px;text-transform:uppercase;">
                    Energy
                  </div>
                </div>
              </td>
              <td align="right" valign="middle" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B7565;font-weight:500;">
                Daily Diesel Price
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="background:#3F6B36;height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>

        <!-- Hero -->
        <tr><td style="padding:44px 32px 18px 32px;background:#ffffff;">
          <p style="margin:0 0 14px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3F6B36;font-weight:600;">
            Quote · {{quote_date}}
          </p>
          <h1 style="margin:0 0 16px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:30px;line-height:1.14;letter-spacing:-0.025em;font-weight:800;color:#0E1F10;">
            Daily diesel price for<br>{{customer_name}}.
          </h1>
          <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3F4A3A;">
            Below is today's on-site delivered diesel price from PACC Energy.
            Reply or call before close of business if you'd like to lock it in.
          </p>
        </td></tr>

        <!-- About / why us -->
        <tr><td style="padding:8px 32px 8px 32px;">
          <p style="margin:18px 0 6px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#6B7565;font-weight:600;">
            About PACC Energy
          </p>
          <p style="margin:0 0 14px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#3F4A3A;">
            National fuel supplier delivering diesel direct to site, backed by a modern
            tanker fleet and a live data portal that shows every litre, every site,
            every machine — in real time.
          </p>
        </td></tr>

        <!-- Feature bullets -->
        <tr><td style="padding:0 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:10px 0;border-top:1px solid #D9D2BF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="40" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;color:#3F6B36;letter-spacing:0.12em;padding-top:2px;">01</td>
                <td valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#3F4A3A;">
                  <strong style="color:#0E1F10;">Live client portal</strong> — every drop tracked per site &amp; machine.
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:10px 0;border-top:1px solid #D9D2BF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="40" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;color:#3F6B36;letter-spacing:0.12em;padding-top:2px;">02</td>
                <td valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#3F4A3A;">
                  <strong style="color:#0E1F10;">Branded PDF dockets</strong> auto-generated for every delivery.
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:10px 0;border-top:1px solid #D9D2BF;border-bottom:1px solid #D9D2BF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="40" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;color:#3F6B36;letter-spacing:0.12em;padding-top:2px;">03</td>
                <td valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#3F4A3A;">
                  <strong style="color:#0E1F10;">Fuel Tax Credit ready</strong> — accurate FTC data per machine for your BAS.
                </td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>

        <!-- PRICING BLOCK -->
        <tr><td style="padding:32px 32px 8px 32px;">
          <p style="margin:0 0 12px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3F6B36;font-weight:700;">
            Daily diesel price
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EEDF;border-left:3px solid #3F6B36;">
            <tr><td style="padding:8px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <tr><td style="padding:18px 22px;border-bottom:1px solid #D9D2BF;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td valign="middle">
                      <p style="margin:0 0 2px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#6B7565;font-weight:700;">
                        Diesel
                      </p>
                      <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:#3F4A3A;">
                        Delivered, ex-GST
                      </p>
                    </td>
                    <td align="right" valign="middle" style="font-family:'Inter',Helvetica,Arial,sans-serif;">
                      <p style="margin:0;font-size:28px;font-weight:800;color:#0E1F10;letter-spacing:-0.02em;line-height:1;">
                        {{diesel_price}}<span style="font-size:14px;color:#6B7565;font-weight:600;"> C/L</span>
                      </p>
                      <p style="margin:4px 0 0 0;font-size:11px;color:#6B7565;">inc GST {{diesel_price_inc}} C/L</p>
                    </td>
                  </tr></table>
                </td></tr>

                <tr><td style="padding:12px 22px;background:#E4DDC9;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td valign="middle" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B7565;font-weight:700;">
                      Valid
                    </td>
                    <td align="right" valign="middle" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:#0E1F10;font-weight:600;">
                      {{quote_date}} &nbsp;&rarr;&nbsp; {{validity}}
                    </td>
                  </tr></table>
                </td></tr>

              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="left" style="padding:24px 32px 36px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:#3F6B36;border-radius:4px;">
              <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=pricing-call&campaign=todays-pricing&to=tel%3A%2B61409704327" style="display:inline-block;padding:14px 26px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                Lock in today's price →
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:#6B7565;">
            Call <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=pricing-phone&campaign=todays-pricing&to=tel%3A%2B61409704327" style="color:#3F6B36;text-decoration:none;font-weight:600;">+61 409 704 327</a>
            or email <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=pricing-email&campaign=todays-pricing&to=mailto%3Afuel%40paccvictoria.com%3Fsubject%3DDaily%2520diesel%2520price%2520{{quote_date}}" style="color:#3F6B36;text-decoration:none;font-weight:600;">fuel@paccvictoria.com</a>.
          </p>
        </td></tr>

        <!-- See the portal -->
        <tr><td style="padding:0 32px 36px 32px;border-top:1px solid #D9D2BF;">
          <p style="margin:24px 0 8px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#6B7565;font-weight:600;">
            What you also get
          </p>
          <p style="margin:0 0 14px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#3F4A3A;">
            Every PACC Energy account includes a live client portal showing every litre delivered,
            broken down per site, project and machine — with FTC-ready exports.
          </p>
          <a href="https://paccenergy.com/portal?demo=true&brand=pacc&source=email" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#3F6B36;text-decoration:none;">
            Tour the live demo portal →
          </a>
        </td></tr>

        <!-- Fine print disclaimer -->
        <tr><td style="padding:0 32px 36px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EEDF;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#6B7565;font-weight:700;">
                Pricing terms
              </p>
              <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10.5px;line-height:1.6;color:#3F4A3A;">
                Pricing valid for {{validity}} from {{quote_date}}.
                Prices shown in cents per litre, ex-GST unless noted. Subject to product availability,
                site access, after-hours surcharges and changes in Terminal Gate Price (TGP).
                Final invoiced price confirmed on delivery.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFE9DC;">
            <tr><td style="padding:32px;">
              <div style="line-height:1;margin-bottom:18px;">
                <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#0E1F10;letter-spacing:-0.03em;text-transform:uppercase;line-height:1;">
                  PACC<span style="color:#3F6B36;font-size:12px;">&reg;</span>
                </div>
                <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:8px;font-weight:500;color:#6B7565;letter-spacing:0.18em;margin-top:3px;text-transform:uppercase;">
                  Energy
                </div>
              </div>
              <p style="margin:0 0 16px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6B7565;">
                Fuel supply, with the data built in.
              </p>
              <p style="margin:0 0 18px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:#6B7565;">
                <a href="https://paccenergy.com" style="color:#3F6B36;text-decoration:none;font-weight:600;">paccenergy.com</a>
                &nbsp;&middot;&nbsp;
                <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=footer-phone&campaign=todays-pricing&to=tel%3A%2B61409704327" style="color:#3F6B36;text-decoration:none;font-weight:600;">+61 409 704 327</a>
                &nbsp;&middot;&nbsp;
                <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=footer-email&campaign=todays-pricing&to=mailto%3Afuel%40paccvictoria.com" style="color:#3F6B36;text-decoration:none;font-weight:600;">fuel@paccvictoria.com</a>
              </p>
              <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10.5px;letter-spacing:0.04em;color:#6B7565;line-height:1.6;">
                You're receiving this pricing quote because you've enquired with PACC Energy. Reply STOP to opt out.
              </p>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>$HTML$ WHERE name = 'Daily Diesel Price v1';

UPDATE public.email_templates SET html_body = $HTML$
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Your fuel data, finally in one place</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',Helvetica,Arial,sans-serif;color:#0E1F10;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Every litre, every site, every machine — live in your PACC Energy portal. No spreadsheets. No waiting for invoices.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:0;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;">

        <!-- Header bar (deep brown, matches site nav) -->
        <tr><td style="background:#EFE9DC;padding:22px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle">
                <div style="line-height:1;">
                  <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;color:#0E1F10;letter-spacing:-0.03em;text-transform:uppercase;line-height:1;">
                    PACC<span style="color:#3F6B36;font-size:14px;">&reg;</span>
                  </div>
                  <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:8px;font-weight:500;color:#6B7565;letter-spacing:0.18em;margin-top:3px;text-transform:uppercase;">
                    Energy
                  </div>
                </div>
              </td>
              <td align="right" valign="middle" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B7565;font-weight:500;">
                Client Portal
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Thin accent stripe -->
        <tr><td style="background:#3F6B36;height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>

        <!-- Hero -->
        <tr><td style="padding:48px 32px 20px 32px;background:#ffffff;">
          <p style="margin:0 0 16px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3F6B36;font-weight:600;">
            A better way to track your fuel
          </p>
          <h1 style="margin:0 0 18px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:32px;line-height:1.12;letter-spacing:-0.025em;font-weight:800;color:#0E1F10;">
            Every litre, every site,<br>finally in one place.
          </h1>
          <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3F4A3A;">
            We built the PACC Energy Client Portal so you never have to chase a docket,
            dig through invoices, or guess where fuel ended up. It's live, branded to your
            account, and already running in the background for every drop we deliver.
          </p>
        </td></tr>

        <!-- CTA -->
        <tr><td align="left" style="padding:8px 32px 40px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:#3F6B36;border-radius:4px;">
              <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=tour&campaign=portal-showcase&to=https%3A%2F%2Fpaccenergy.com%2Fportal%3Fdemo%3Dtrue%26brand%3Dpacc%26source%3Demail" style="display:inline-block;padding:14px 26px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                Explore the live demo →
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:#6B7565;">
            No login required for the demo.
          </p>
          <p style="margin:6px 0 0 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:#6B7565;">
            Link not working? <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=tour-fallback&campaign=portal-showcase&to=https%3A%2F%2Fpaccenergy.com%2Fportal%3Fdemo%3Dtrue%26brand%3Dpacc%26source%3Demail" style="color:#3F6B36;text-decoration:underline;font-weight:600;">Open the demo portal directly</a>.
          </p>
        </td></tr>

        <!-- Section title -->
        <tr><td style="padding:8px 32px 4px 32px;border-top:1px solid #D9D2BF;">
          <p style="margin:32px 0 6px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#6B7565;font-weight:600;">
            What's inside
          </p>
          <h2 style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:22px;letter-spacing:-0.02em;font-weight:800;color:#0E1F10;">
            Five views your team will actually use.
          </h2>
        </td></tr>

        <!-- Feature rows -->
        <tr><td style="padding:24px 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

            <tr><td style="padding:16px 0;border-bottom:1px solid #D9D2BF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="52" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;color:#3F6B36;letter-spacing:0.12em;padding-top:2px;">01</td>
                <td valign="top">
                  <p style="margin:0 0 4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#0E1F10;letter-spacing:-0.01em;">Overview</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#3F4A3A;">
                    Headline numbers — litres, spend, deliveries — for any date range. Always live.
                  </p>
                </td>
              </tr></table>
            </td></tr>

            <tr><td style="padding:16px 0;border-bottom:1px solid #D9D2BF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="52" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;color:#3F6B36;letter-spacing:0.12em;padding-top:2px;">02</td>
                <td valign="top">
                  <p style="margin:0 0 4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#0E1F10;letter-spacing:-0.01em;">Deliveries</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#3F4A3A;">
                    Every drop, in real time. Click any row to download a branded PDF docket — no more chasing paperwork.
                  </p>
                </td>
              </tr></table>
            </td></tr>

            <tr><td style="padding:16px 0;border-bottom:1px solid #D9D2BF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="52" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;color:#3F6B36;letter-spacing:0.12em;padding-top:2px;">03</td>
                <td valign="top">
                  <p style="margin:0 0 4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#0E1F10;letter-spacing:-0.01em;">Projects</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#3F4A3A;">
                    Fuel costs broken out per site or job. Bill it back to the right cost code without a spreadsheet.
                  </p>
                </td>
              </tr></table>
            </td></tr>

            <tr><td style="padding:16px 0;border-bottom:1px solid #D9D2BF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="52" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;color:#3F6B36;letter-spacing:0.12em;padding-top:2px;">04</td>
                <td valign="top">
                  <p style="margin:0 0 4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#0E1F10;letter-spacing:-0.01em;">Plant</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#3F4A3A;">
                    Fuel rolled up by machine — excavator, loader, genset. Spot a thirsty unit before it costs you.
                  </p>
                </td>
              </tr></table>
            </td></tr>

            <tr><td style="padding:16px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="52" valign="top" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;color:#3F6B36;letter-spacing:0.12em;padding-top:2px;">05</td>
                <td valign="top">
                  <p style="margin:0 0 4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#0E1F10;letter-spacing:-0.01em;">Emissions &amp; Exports</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#3F4A3A;">
                    Auto-calculated Scope 1 CO₂e for ESG reporting. CSV export of any view for your accounts team.
                  </p>
                </td>
              </tr></table>
            </td></tr>

          </table>
        </td></tr>

        <!-- Why it matters callout (cream surface) -->
        <tr><td style="padding:24px 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EEDF;border-left:3px solid #3F6B36;">
            <tr><td style="padding:22px 24px;">
              <p style="margin:0 0 10px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3F6B36;font-weight:700;">
                Why it matters
              </p>
              <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#0E1F10;">
                Most fuel suppliers hand you a monthly invoice and call it a day. We give you the underlying data —
                live, per-site, per-machine — so your team can answer the questions accountants and project managers
                actually ask. Included with every PACC Energy account.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Soft win-back -->
        <tr><td style="padding:36px 32px 8px 32px;">
          <p style="margin:0 0 8px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#6B7565;font-weight:600;">
            For new customers
          </p>
          <h3 style="margin:0 0 12px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0E1F10;">
            Not currently buying fuel from us?
          </h3>
          <p style="margin:0 0 20px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#3F4A3A;">
            Switching is straightforward. We'll match your existing pricing structure, set up your portal,
            and have your sites live within a week. No platform fees, no lock-in.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4EEDF;border-left:3px solid #3F6B36;">
            <tr><td style="padding:18px 22px 8px 22px;">
              <p style="margin:0 0 14px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#6B7565;font-weight:600;">
                Talk to us directly
              </p>
            </td></tr>

            <!-- Tap to call row -->
            <tr><td style="padding:0 22px 12px 22px;">
              <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=walkthrough-phone&campaign=portal-showcase&to=tel%3A%2B61409704327" style="display:block;text-decoration:none;color:#0E1F10;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #D9D2BF;border-radius:6px;">
                  <tr>
                    <td style="padding:12px 14px;font-family:'Inter',Helvetica,Arial,sans-serif;">
                      <p style="margin:0 0 2px 0;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#6B7565;font-weight:600;">
                        Tap to call
                      </p>
                      <p style="margin:0;font-size:18px;font-weight:800;color:#0E1F10;letter-spacing:-0.01em;">
                        +61 409 704 327
                      </p>
                    </td>
                    <td align="right" valign="middle" style="padding:12px 16px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#3F6B36;white-space:nowrap;">
                      Call →
                    </td>
                  </tr>
                </table>
              </a>
            </td></tr>

            <!-- Email row (long-press to copy on mobile) -->
            <tr><td style="padding:0 22px 12px 22px;">
              <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=walkthrough-email&campaign=portal-showcase&to=mailto%3Afuel%40paccvictoria.com%3Fsubject%3DPortal%2520walkthrough" style="display:block;text-decoration:none;color:#0E1F10;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #D9D2BF;border-radius:6px;">
                  <tr>
                    <td style="padding:12px 14px;font-family:'Inter',Helvetica,Arial,sans-serif;">
                      <p style="margin:0 0 2px 0;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#6B7565;font-weight:600;">
                        Email · long-press to copy
                      </p>
                      <p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:14px;font-weight:600;color:#0E1F10;word-break:break-all;">
                        fuel@paccvictoria.com
                      </p>
                    </td>
                    <td align="right" valign="middle" style="padding:12px 16px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#3F6B36;white-space:nowrap;">
                      Email →
                    </td>
                  </tr>
                </table>
              </a>
            </td></tr>

            <!-- Business hours -->
            <tr><td style="padding:4px 22px 18px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B7565;font-weight:600;padding-bottom:6px;">
                    Business hours · AEST
                  </td>
                </tr>
                <tr>
                  <td style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:#0E1F10;line-height:1.65;">
                    <strong style="color:#0E1F10;">Mon–Fri</strong> &nbsp;6:00 am – 6:00 pm<br>
                    <strong style="color:#0E1F10;">Sat</strong> &nbsp;7:00 am – 1:00 pm<br>
                    <span style="color:#6B7565;">Sun · closed</span> &nbsp;<span style="color:#3F4A3A;">(after-hours: phone only)</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer (deep brown, matches site footer) -->
        <tr><td style="padding:48px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFE9DC;">
            <tr><td style="padding:32px;">
              <div style="line-height:1;margin-bottom:18px;">
                <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#0E1F10;letter-spacing:-0.03em;text-transform:uppercase;line-height:1;">
                  PACC<span style="color:#3F6B36;font-size:12px;">&reg;</span>
                </div>
                <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:8px;font-weight:500;color:#6B7565;letter-spacing:0.18em;margin-top:3px;text-transform:uppercase;">
                  Energy
                </div>
              </div>
              <p style="margin:0 0 16px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6B7565;">
                Reliable fuel supply with the data layer built in.
              </p>
              <p style="margin:0 0 18px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:#6B7565;">
                <a href="https://paccenergy.com" style="color:#3F6B36;text-decoration:none;font-weight:600;">paccenergy.com</a>
                &nbsp;&middot;&nbsp;
                <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=footer-phone&campaign=portal-showcase&to=tel%3A%2B61409704327" style="color:#3F6B36;text-decoration:none;font-weight:600;">+61 409 704 327</a>
                &nbsp;&middot;&nbsp;
                <a href="https://qvpnfxssfhfxqqkbmahw.supabase.co/functions/v1/track-email-click?cta=footer-email&campaign=portal-showcase&to=mailto%3Afuel%40paccvictoria.com" style="color:#3F6B36;text-decoration:none;font-weight:600;">fuel@paccvictoria.com</a>
              </p>
              <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10.5px;letter-spacing:0.04em;color:#6B7565;line-height:1.6;">
                You're receiving this because you've been in touch with PACC Energy. Reply STOP to opt out.
              </p>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
$HTML$ WHERE name = 'Portal Showcase v6';
