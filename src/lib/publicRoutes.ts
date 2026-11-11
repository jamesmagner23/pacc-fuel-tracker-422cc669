import { matchPath } from "react-router-dom";

const paths = ["/", "/landing", "/privacy", "/terms", "/login", "/reset-password", "/brand-check", "/docket/multi", "/docket/:id", "/operations", "/operations/customers/:name", "/customers", "/customers/:name", "/performance", "/transactions", "/finance", "/admin", "/admin/:tab", "/dispatch", "/suppliers", "/market", "/sales", "/trucks", "/crm", "/driver", "/portal", ...["overview", "signed-dockets", "deliveries", "fleet", "projects", "reports", "profile", "help"].map(tab => `/portal/${tab}`)];
export function isKnownRoute(path: string): boolean {
  const normalized = path.replace(/^\/portal\/client(?:\/|$)/, "/portal/").replace(/\/$/, "") || "/";
  return paths.some(pattern => matchPath({ path: pattern, end: true }, normalized));
}
export const alwaysPublicPaths = ["/landing", "/privacy", "/terms"];