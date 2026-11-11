import { expect, it } from "vitest";
import { validateDocketFile } from "./docketUpload";
it("accepts a PDF at exactly 10 MB", () => {
  expect(validateDocketFile({ size: 10 * 1024 * 1024, type: "application/pdf" })).toBeNull();
});
it("rejects files above 10 MB", () => {
  expect(validateDocketFile({ size: 10 * 1024 * 1024 + 1, type: "image/png" })).not.toBeNull();
});
it("rejects non PDF and non image files", () => {
  expect(validateDocketFile({ size: 100, type: "text/html" })).not.toBeNull();
});
it("accepts an image attachment", () => {
  expect(validateDocketFile({ size: 100, type: "image/jpeg" })).toBeNull();
});