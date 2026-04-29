const PACC_PORTAL_DEMO_URL = "https://paccenergy.com/portal?demo=true&brand=pacc&source=email";
const ENCODED_PACC_PORTAL_DEMO_URL = encodeURIComponent(PACC_PORTAL_DEMO_URL);

/**
 * Keeps outreach templates safe: any PACC portal link becomes the no-signup,
 * PACC-branded client portal demo link used by email recipients.
 */
export function normalizePortalDemoLinks(content: string): string {
  if (!content) return content;

  return content
    .replace(
      /https%3A%2F%2F(?:www%2E)?paccenergy%2Ecom%2Fportal(?:%3F[^&"'<>\s]*)?/gi,
      ENCODED_PACC_PORTAL_DEMO_URL,
    )
    .replace(
      /https?:\/\/(?:www\.)?paccenergy\.com\/portal(?:\?[^"'<>\s)]*)?/gi,
      PACC_PORTAL_DEMO_URL,
    );
}

export { PACC_PORTAL_DEMO_URL };