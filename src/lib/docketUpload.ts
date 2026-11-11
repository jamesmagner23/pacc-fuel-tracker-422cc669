export const MAX_DOCKET_BYTES = 10 * 1024 * 1024;
export const DOCKET_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];
export function validateDocketFile(file: { size: number; type: string }) {
  if (file.size > MAX_DOCKET_BYTES) return "File must be 10 MB or smaller";
  if (!DOCKET_MIME_TYPES.includes(file.type)) return "Attach a PDF or supported image";
  return null;
}