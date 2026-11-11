export function quoteLeadContact(email: string, litres: string) {
  const normalized = email.trim();
  const volume = litres.trim() === "" ? null : Number(litres);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Please enter a valid email address.");
  if (volume !== null && (!Number.isFinite(volume) || volume < 0)) throw new Error("Estimated litres must be zero or greater.");
  return { email: normalized.slice(0, 254), estimated_litres: volume };
}