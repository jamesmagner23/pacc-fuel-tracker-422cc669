import { expect, it } from "vitest";
import { withTimeout } from "./requestTimeout";
it("rejects stalled requests instead of leaving an endless spinner", async () => {
  await expect(withTimeout(new Promise(() => {}), 5)).rejects.toThrow("timed out");
});
it("returns successful empty results", async () => {
  await expect(withTimeout(Promise.resolve([]), 5)).resolves.toEqual([]);
});