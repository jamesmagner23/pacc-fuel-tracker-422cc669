import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!match) throw new Error("Business structured data is missing");
const business = JSON.parse(match[1]);

describe("confirmed structured business details", () => {
  it("uses the confirmed international business phone", () => {
    expect(business.telephone).toBe("+61 409 704 327");
  });
  it("uses the confirmed legal entity and ABN", () => {
    expect(business.legalName).toBe("The trustee for PACC Business Trust");
    expect(business.taxID).toBe("57 989 556 600");
  });
  it("uses the confirmed founding year", () => {
    expect(business.foundingDate).toBe("2024");
  });
  it("covers all seven days with 24-hour availability", () => {
    expect(business.openingHoursSpecification).toEqual([{
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "00:00",
      closes: "23:59",
    }]);
  });
});