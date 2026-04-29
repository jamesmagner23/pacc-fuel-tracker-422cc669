#!/usr/bin/env node
/**
 * Email rendering QA
 * ------------------
 * Verifies the showcase email exports correctly before sending:
 *   1. HTML parses
 *   2. The "tour" CTA points at the demo portal with brand=pacc
 *   3. The "walkthrough" contact card has the correct phone + email
 *   4. Renders a preview PNG so you can eyeball it
 *
 * Usage:  node scripts/email-qa/qa-email.mjs [path-to-html]
 * Default input: /mnt/documents/pacc-portal-showcase-email_v3.html
 * Output:        /mnt/documents/email-preview.png   (+ exits non-zero on failure)
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

const inputPath = resolve(process.argv[2] || "/mnt/documents/pacc-portal-showcase-email_v3.html");
const previewPath = "/mnt/documents/email-preview.png";

/* ── Expected values ─────────────────────────────────────────────── */
const EXPECTED = {
  tourHrefIncludes: ["/portal", "demo=true", "brand=pacc"],
  tourLabelMatches: /tour|demo|explore/i,
  walkthroughPhone: "+61409704327",      // tel: link (no spaces)
  walkthroughPhoneDisplay: "+61 409 704 327",
  walkthroughEmail: "fuel@paccvictoria.com",
  forbiddenStrings: [
    "hello@paccenergy.com",              // old contact, must be gone
    "Book a 15-min walkthrough",         // old CTA copy
  ],
};

/* ── Load file ───────────────────────────────────────────────────── */
if (!existsSync(inputPath)) {
  console.error(RED(`✗ File not found: ${inputPath}`));
  process.exit(2);
}
const html = readFileSync(inputPath, "utf8");
console.log(DIM(`Reading ${inputPath} (${html.length} bytes)`));

/* ── Checks ──────────────────────────────────────────────────────── */
const failures = [];
const passes = [];
const check = (name, ok, detail = "") => {
  (ok ? passes : failures).push({ name, detail });
};

// 1. Sanity: looks like HTML email
check("HTML doctype present", /<!doctype html>/i.test(html));
check("Has <body>", /<body[\s>]/i.test(html));
check("Table-based layout (cellpadding=\"0\")", html.includes('cellpadding="0"'));

// 2. Tour CTA — find any <a> whose label matches tour wording, then validate href
const anchorRe = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
const anchors = [...html.matchAll(anchorRe)].map(([, href, inner]) => ({
  href,
  text: inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
}));

const tourAnchor = anchors.find((a) => EXPECTED.tourLabelMatches.test(a.text));
check("Tour CTA exists", !!tourAnchor, tourAnchor ? `"${tourAnchor.text}"` : "no anchor matched tour/demo/explore");
if (tourAnchor) {
  for (const frag of EXPECTED.tourHrefIncludes) {
    check(`Tour href contains "${frag}"`, tourAnchor.href.includes(frag), tourAnchor.href);
  }
  check("Tour href is HTTPS", tourAnchor.href.startsWith("https://"), tourAnchor.href);
}

// 3. Walkthrough contact details
const telAnchor = anchors.find((a) => a.href.startsWith("tel:"));
check("Phone (tel:) link exists", !!telAnchor, telAnchor?.href);
if (telAnchor) {
  check(
    `Phone number is ${EXPECTED.walkthroughPhoneDisplay}`,
    telAnchor.href === `tel:${EXPECTED.walkthroughPhone}`,
    telAnchor.href
  );
}
check(
  "Phone number rendered with spaces",
  html.includes(EXPECTED.walkthroughPhoneDisplay),
  EXPECTED.walkthroughPhoneDisplay
);

const mailAnchor = anchors.find((a) => a.href.startsWith(`mailto:${EXPECTED.walkthroughEmail}`));
check("Walkthrough email link exists", !!mailAnchor, mailAnchor?.href);

// 4. No stale content from earlier versions
for (const banned of EXPECTED.forbiddenStrings) {
  check(`Stale string removed: "${banned}"`, !html.includes(banned));
}

/* ── Print report ────────────────────────────────────────────────── */
console.log();
for (const p of passes)    console.log(`${GREEN("✓")} ${p.name}`     + (p.detail ? DIM(`  — ${p.detail}`) : ""));
for (const f of failures)  console.log(`${RED("✗")} ${f.name}`       + (f.detail ? DIM(`  — ${f.detail}`) : ""));
console.log();
console.log(DIM(`${passes.length} passed, ${failures.length} failed`));

/* ── Render preview PNG ──────────────────────────────────────────── */
console.log(DIM(`\nRendering preview → ${previewPath}`));
try {
  execSync(
    `nix run nixpkgs#chromium -- --headless=new --disable-gpu --no-sandbox ` +
    `--hide-scrollbars --window-size=680,3200 --virtual-time-budget=2000 ` +
    `--screenshot=${previewPath} file://${inputPath}`,
    { stdio: "pipe", timeout: 120_000 }
  );
  console.log(GREEN(`✓ Preview written to ${previewPath}`));
} catch (err) {
  console.log(RED(`✗ Preview render failed: ${err.message.split("\n")[0]}`));
  failures.push({ name: "Preview render", detail: err.message.split("\n")[0] });
}

/* ── Exit code ───────────────────────────────────────────────────── */
process.exit(failures.length === 0 ? 0 : 1);