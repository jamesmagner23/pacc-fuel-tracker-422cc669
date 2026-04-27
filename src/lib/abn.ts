/**
 * Australian Business Number (ABN) utilities.
 * Validation uses the official ATO checksum:
 * https://abr.business.gov.au/Help/AbnFormat
 */

const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/** Strip all non-digit characters. */
export function stripAbn(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Format an ABN as "XX XXX XXX XXX" (partial input is formatted progressively). */
export function formatAbn(value: string): string {
  const digits = stripAbn(value).slice(0, 11);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 5));
  if (digits.length > 5) parts.push(digits.slice(5, 8));
  if (digits.length > 8) parts.push(digits.slice(8, 11));
  return parts.join(" ");
}

/** True if the 11-digit ABN passes the ATO modulus-89 checksum. */
export function isValidAbn(value: string): boolean {
  const digits = stripAbn(value);
  if (digits.length !== 11) return false;
  // First digit cannot be 0
  if (digits[0] === "0") return false;
  const nums = digits.split("").map((d) => parseInt(d, 10));
  // Subtract 1 from the first digit
  nums[0] -= 1;
  const sum = nums.reduce((acc, n, i) => acc + n * WEIGHTS[i], 0);
  return sum % 89 === 0;
}

/**
 * Returns a human-friendly validation message, or null when the value is
 * either empty (treated as "not set") or a valid ABN.
 */
export function abnError(value: string | null | undefined): string | null {
  if (!value) return null; // empty is allowed (clears the field)
  const digits = stripAbn(value);
  if (digits.length === 0) return null;
  if (digits.length !== 11) return `ABN must be 11 digits (you entered ${digits.length})`;
  if (!isValidAbn(digits)) return "ABN checksum is invalid — please double-check";
  return null;
}
