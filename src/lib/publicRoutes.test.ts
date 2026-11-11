import { describe, it, expect } from "vitest";
import { isKnownRoute } from "./publicRoutes";
describe("public route classification", () => {
  it("does not send unknown public routes through authentication", () => {
    expect(isKnownRoute("/unknown-page")).toBe(false);
    expect(isKnownRoute("/portal/unknown-page")).toBe(false);
    expect(isKnownRoute("/portal/client/unknown-page")).toBe(false);
  });
  it("keeps the legal and legacy docket routes reachable", () => {
    expect(isKnownRoute("/privacy")).toBe(true);
    expect(isKnownRoute("/terms")).toBe(true);
    expect(isKnownRoute("/portal/client/signed-dockets")).toBe(true);
  });
});