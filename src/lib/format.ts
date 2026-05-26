import { format } from "date-fns";

/**
 * Site-wide date/time formatters. Adopt these instead of ad-hoc
 * date-fns calls so the entire app speaks one dialect:
 *
 *   time:     "1:46pm"           (12h, no leading zero, no space, lowercase)
 *   date:     "26 May" or
 *             "26 May 2024"      (year only when not the current year)
 *   datetime: "26 May · 1:46pm"
 */
export function formatTime(input: Date | string | number | null | undefined): string {
  if (input == null) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return format(d, "h:mmaaa");
}

export function formatDate(input: Date | string | number | null | undefined): string {
  if (input == null) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  const showYear = d.getFullYear() !== new Date().getFullYear();
  return format(d, showYear ? "d MMM yyyy" : "d MMM");
}

export function formatDateTime(input: Date | string | number | null | undefined): string {
  if (input == null) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return `${formatDate(d)} · ${formatTime(d)}`;
}