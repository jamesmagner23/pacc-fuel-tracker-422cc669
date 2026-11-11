import { expect, it } from "vitest";
import { hasReconciliationData } from "./reconciliationStatus";
it("requires pump readings before reconciliation can succeed", () => {
  expect(hasReconciliationData(0, 10)).toBe(false);
});
it("requires transaction data before reconciliation can succeed", () => {
  expect(hasReconciliationData(10, 0)).toBe(false);
});
it("permits reconciliation only when both sources exist", () => {
  expect(hasReconciliationData(10, 10)).toBe(true);
});