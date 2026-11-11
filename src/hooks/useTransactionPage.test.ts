import { beforeEach, expect, it, vi } from "vitest";
const { builder, from } = vi.hoisted(() => {
  const builder: Record<string, any> = {};
  for (const name of ["select", "gte", "lte", "eq", "ilike", "order", "range", "abortSignal"]) builder[name] = vi.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 304, error: null }).then(resolve);
  return { builder, from: vi.fn(() => builder) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { fetchTransactionPage } from "./useTransactionPage";
beforeEach(() => vi.clearAllMocks());
const filters = { start: "2026-10-01", end: "2026-10-31", search: "TRACK WORKS", customer: "", truck: "", driver: "", sort: "fecha", ascending: false };
it("requests 50 rows with an exact total count", async () => {
  const result = await fetchTransactionPage(filters, 0);
  expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("id,fecha,date"), { count: "exact" });
  expect(builder.range).toHaveBeenCalledWith(0, 49);
  expect(result.count).toBe(304);
});
it("advances the server range for the second page", async () => {
  await fetchTransactionPage(filters, 1);
  expect(builder.range).toHaveBeenCalledWith(50, 99);
});
it("searches all customers in the selected date bounds on the server", async () => {
  await fetchTransactionPage(filters, 0);
  expect(builder.gte).toHaveBeenCalledWith("date", "2026-10-01");
  expect(builder.lte).toHaveBeenCalledWith("date", "2026-10-31");
  expect(builder.ilike).toHaveBeenCalledWith("nombre_cliente1", "%TRACK WORKS%");
});