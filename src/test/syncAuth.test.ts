import { describe, expect, it, vi } from "vitest";
import { authorizeSync, syncFailureResponse } from "../../supabase/functions/sync-transactions/auth";

describe("sync authorization", () => {
  const dependencies = () => ({
    readCronToken: vi.fn(async () => "test-only-token"),
    validateAdmin: vi.fn(async (jwt: string): Promise<401 | 403 | null> => jwt === "admin" ? null : jwt === "client" ? 403 : 401),
  });
  it("accepts a matching private cron token without a user JWT", async () => {
    const deps = dependencies();
    expect(await authorizeSync(new Headers({ "x-cron-token": "test-only-token" }), deps)).toBeNull();
    expect(deps.validateAdmin).not.toHaveBeenCalled();
  });
  it("rejects missing credentials", async () => {
    expect(await authorizeSync(new Headers(), dependencies())).toBe(401);
  });
  it("rejects an invalid cron token", async () => {
    expect(await authorizeSync(new Headers({ "x-cron-token": "wrong" }), dependencies())).toBe(401);
  });
  it("preserves the admin JWT path even with an invalid cron token", async () => {
    expect(await authorizeSync(new Headers({ "x-cron-token": "wrong", Authorization: "Bearer admin" }), dependencies())).toBeNull();
  });
  it("rejects non-admin JWTs", async () => {
    expect(await authorizeSync(new Headers({ Authorization: "Bearer client" }), dependencies())).toBe(403);
  });
  it("rejects anonymous bearer credentials", async () => {
    expect(await authorizeSync(new Headers({ Authorization: "Bearer anon" }), dependencies())).toBe(401);
  });
  it("fails closed when the cron-token lookup fails", async () => {
    const deps = dependencies();
    deps.readCronToken.mockRejectedValue(new Error("unavailable"));
    expect(await authorizeSync(new Headers({ "x-cron-token": "test-only-token" }), deps)).toBe(401);
  });
  it("returns a non-200 status on sync failure", async () => {
    const response = syncFailureResponse(12, { "Content-Type": "application/json" });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "Sync failed", records_fetched: 12 });
  });
});