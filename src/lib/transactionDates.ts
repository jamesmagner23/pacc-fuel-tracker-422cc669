import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
export type TransactionPreset = "today" | "week" | "30d" | "month" | "last-month" | "custom";
export function melbourneDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function transactionDateRange(preset: TransactionPreset, from: string, to: string, now = new Date()) {
  const today = new Date(`${melbourneDate(now)}T12:00:00`);
  if (preset === "custom") return { start: from, end: to };
  const start = preset === "today" ? today : preset === "week" ? startOfWeek(today, { weekStartsOn: 1 }) : preset === "30d" ? subDays(today, 29) : preset === "last-month" ? startOfMonth(subMonths(today, 1)) : startOfMonth(today);
  return { start: format(start, "yyyy-MM-dd"), end: format(preset === "last-month" ? endOfMonth(subMonths(today, 1)) : today, "yyyy-MM-dd") };
}
export function nextExciseIndexation(now = new Date()) {
  const today = melbourneDate(now), year = Number(today.slice(0, 4));
  const date = [`${year}-02-01`, `${year}-08-01`, `${year + 1}-02-01`].find(d => d > today) ?? `${year + 1}-02-01`;
  return { date, days: Math.max(0, Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)) };
}