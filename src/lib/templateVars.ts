/**
 * Substitute {{variable}} placeholders in a template string.
 * Unknown variables are left as-is so the user can spot them.
 */
export function renderTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const v = values[key];
    return v != null && v !== "" ? v : match;
  });
}

/** Extract every {{variable}} key referenced in the given strings. */
export function extractVariables(...strings: string[]): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  for (const s of strings) {
    if (!s) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) set.add(m[1]);
  }
  return Array.from(set);
}