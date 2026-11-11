import { describe, expect, it } from "vitest";
import { createTransactionPricer, effectiveBuyPrice, safeDelta, pricingCoverage } from "./transactionPricing";
import { customerPricingSummaries } from "../../supabase/functions/_shared/transactionPricing";
const clients = [{ id: 32, company_name: "TRACKWORKS", speedsol_names: ["TRACK WORKS"] }];
const tiers = [{ client_account_id: 32, min_litres: 0, max_litres: 500, margin_percent: 10, pricing_type: "margin" }, { client_account_id: 32, min_litres: 500, max_litres: null, margin_percent: 15, pricing_type: "markup" }];
// Synthetic unit-test inputs only, never published as prices or rates.
const buys = [{ price_date: "2026-11-01", price_per_litre: 2 }, { price_date: "2026-11-10", price_per_litre: 3 }];
const tx = { id: 1, fecha: "2026-11-02T01:00:00Z", date: "2026-11-02", nombre_cliente1: "TRACK WORKS", cantidad: 100, ppu: 0, dinero_total: 0 };
describe("historical ticket pricing", () => {
  it("aggregates customer revenue with the same calculated ticket prices", () => {
    const price = createTransactionPricer([tx], clients, tiers, buys, "2026-11-11");
    expect(customerPricingSummaries([tx], price)[0].revenue).toBeCloseTo(220);
  });
  it("leaves untiered customer revenue missing rather than zero", () => {
    const price = createTransactionPricer([tx], clients, [], buys, "2026-11-11");
    expect(customerPricingSummaries([tx], price)[0]).toMatchObject({ revenue: null, unpricedLitres: 100 });
  });
  it("uses the effective historical buy price, not the current price", () => {
    const result = createTransactionPricer([tx], clients, tiers, buys, "2026-11-11")(tx);
    expect(result.sellPPL).toBe(2.2); expect(result.total).toBeCloseTo(220); expect(result.source).toBe("calculated");
  });
  it("falls back to latest available current buy only when history is absent", () => {
    expect(effectiveBuyPrice(buys, "2025-01-01", "2026-11-11")).toBe(3);
  });
  it("does not use future prices", () => {
    expect(effectiveBuyPrice(buys, "2026-11-02", "2026-11-02")).toBe(2);
  });
  it("preserves real SpeedSol prices", () => {
    expect(createTransactionPricer([tx], clients, tiers, buys, "2026-11-11")({ ...tx, ppu: 4 }).sellPPL).toBe(4);
    expect(createTransactionPricer([tx], clients, tiers, buys, "2026-11-11")({ ...tx, dinero_total: 450 }).total).toBe(450);
  });
  it("never fabricates prices for a customer without a tier", () => {
    expect(createTransactionPricer([tx], clients, [], buys, "2026-11-11")(tx)).toEqual({ hasPricing: false, sellPPL: null, total: null, source: "missing" });
  });
  it("uses full weekly volume regardless of visible page", () => {
    const price = createTransactionPricer([tx, { ...tx, id: 2, cantidad: 500 }], clients, tiers, buys, "2026-11-11");
    expect(price(tx).sellPPL).toBe(2.15);
  });
  it("preserves the highest configured tier above its labelled maximum", () => {
    const configured = [{ ...tiers[0], min_litres: 0, max_litres: 3500 }];
    const large = { ...tx, cantidad: 4000 };
    expect(createTransactionPricer([large], clients, configured, buys, "2026-11-11")(large).hasPricing).toBe(true);
  });
  it("counts missing litres and distinct customers", () => {
    const price = createTransactionPricer([tx], clients, [], buys, "2026-11-11");
    expect(pricingCoverage([tx, { ...tx, id: 2 }], price)).toMatchObject({ unpricedLitres: 200, unpricedCustomers: 1, ratesMissing: true });
  });
  it("suppresses all deltas involving zero", () => {
    expect(safeDelta(0, 100)).toBeNull(); expect(safeDelta(100, 0)).toBeNull(); expect(safeDelta(120, 100)).toBe(20);
  });
});