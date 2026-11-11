import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const { builder, rpc } = vi.hoisted(() => {
  const builder: Record<string, any> = {};
  for (const key of ["order", "range", "abortSignal"]) builder[key] = vi.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 51, error: null }).then(resolve);
  return { builder, rpc: vi.fn(() => builder) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { useSignedDockets } from "./useSignedDockets";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("requests 25 dockets per page with exact count and customer/date filters", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useSignedDockets(32, "2026-10-01", "2026-10-31", 1), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(rpc).toHaveBeenCalledWith("list_signed_dockets", { _client: 32, _from: "2026-10-01", _to: "2026-10-31" }, { count: "exact" });
  expect(builder.range).toHaveBeenCalledWith(25, 49);
  expect(result.current.data?.count).toBe(51);
});