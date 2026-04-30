UPDATE public.email_templates
SET html_body = REPLACE(
  html_body,
  '<p style="margin:4px 0 0 0;font-size:11px;color:#8B7355;">inc GST {{diesel_price_inc}} C/L</p>
                    </td>
                  </tr></table>
                </td></tr>

              </table>',
  '<p style="margin:4px 0 0 0;font-size:11px;color:#8B7355;">inc GST {{diesel_price_inc}} C/L</p>
                    </td>
                  </tr></table>
                </td></tr>

                <tr><td style="padding:12px 22px;background:#F3E8D3;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td valign="middle" style="font-family:''Inter'',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#8B7355;font-weight:700;">
                      Valid
                    </td>
                    <td align="right" valign="middle" style="font-family:''Inter'',Helvetica,Arial,sans-serif;font-size:12px;color:#3D2B1A;font-weight:600;">
                      {{quote_date}} &nbsp;&rarr;&nbsp; {{validity}}
                    </td>
                  </tr></table>
                </td></tr>

              </table>'
),
updated_at = now()
WHERE id = '0e6ebb03-caf5-418f-af63-8b5961380c9b'
  AND html_body NOT LIKE '%Valid%{{quote_date}}%';