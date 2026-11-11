import { describe, expect, it } from "vitest";
import { quoteLeadContact } from "./quoteLeadContact";
describe("quote enquiry contact", () => {
  it("requires a valid email", () => {
    expect(() => quoteLeadContact("", "")).toThrow();
    expect(() => quoteLeadContact("invalid", "")).toThrow();
    expect(quoteLeadContact(" person@example.com ", "").email).toBe("person@example.com");
  });
  it("allows optional litres with a minimum of zero", () => {
    expect(quoteLeadContact("person@example.com", "").estimated_litres).toBeNull();
    expect(quoteLeadContact("person@example.com", "0").estimated_litres).toBe(0);
    expect(() => quoteLeadContact("person@example.com", "-1")).toThrow();
  });
});