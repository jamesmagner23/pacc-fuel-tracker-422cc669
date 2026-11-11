import { describe, expect, it } from "vitest";
import { nextExciseIndexation, transactionDateRange } from "./transactionDates";
describe("Melbourne calendar rules", () => {
  it("counts toward 1 February after August", () => {
    expect(nextExciseIndexation(new Date("2026-11-11T04:50:00Z"))).toEqual({ date: "2027-02-01", days: 82 });
  });
  it("counts toward 1 August after February", () => {
    expect(nextExciseIndexation(new Date("2026-03-01T00:00:00Z")).date).toBe("2026-08-01");
  });
  it("always picks a strictly future indexation date in Melbourne", () => {
    expect(nextExciseIndexation(new Date("2026-01-31T14:00:00Z")).date).toBe("2026-08-01");
  });
  it("uses the last full calendar month", () => {
    expect(transactionDateRange("last-month", "", "", new Date("2026-11-11T04:50:00Z"))).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });
  it("includes exactly 30 calendar days in the 30-day preset", () => {
    expect(transactionDateRange("30d", "", "", new Date("2026-11-11T04:50:00Z"))).toEqual({ start: "2026-10-13", end: "2026-11-11" });
  });
  it("keeps custom bounds", () => {
    expect(transactionDateRange("custom", "2025-01-01", "2025-12-31")).toEqual({ start: "2025-01-01", end: "2025-12-31" });
  });
});