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
import { resolve, basename } from "node:path";
import { createServer } from "node:http";

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

const inputPath = resolve(process.argv[2] || "/mnt/documents/pacc-portal-showcase-email_v4.html");
const previewPath = "/mnt/documents/email-preview.png";
const previewMobilePath = "/mnt/documents/email-preview-mobile.png";

/* ── Expected values ─────────────────────────────────────────────── */
const EXPECTED = {
  tourHrefIncludes: [
    "/functions/v1/track-email-click",
    "cta=tour",
    "campaign=portal-showcase",
    "%2Fportal",        // url-encoded /portal in the &to= destination
    "demo%3Dtrue",
    "brand%3Dpacc",
  ],
  tourLabelMatches: /tour|demo|explore/i,
  walkthroughPhone: "+61409704327",      // tel: link (no spaces)
  walkthroughPhoneDisplay: "+61 409 704 327",
  walkthroughEmail: "fuel@paccvictoria.com",
  forbiddenStrings: [
    "hello@paccenergy.com",              // old contact, must be gone
    "Book a 15-min walkthrough",         // old CTA copy
  ],
  trackedCtas: ["tour", "walkthrough-phone", "walkthrough-email", "footer-phone", "footer-email"],
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
// Phone is now wrapped by the tracker — destination is url-encoded inside &to=
const phoneAnchor = anchors.find((a) =>
  a.href.includes("cta=walkthrough-phone") &&
  a.href.includes(encodeURIComponent(`tel:${EXPECTED.walkthroughPhone}`))
);
check("Tracked walkthrough-phone link exists", !!phoneAnchor, phoneAnchor?.href);
check(
  "Phone number rendered with spaces",
  html.includes(EXPECTED.walkthroughPhoneDisplay),
  EXPECTED.walkthroughPhoneDisplay
);

const mailAnchor = anchors.find((a) =>
  a.href.includes("cta=walkthrough-email") &&
  a.href.includes(encodeURIComponent(`mailto:${EXPECTED.walkthroughEmail}`))
);
check("Tracked walkthrough-email link exists", !!mailAnchor, mailAnchor?.href);

// All five tracked CTA ids must appear at least once
for (const cta of EXPECTED.trackedCtas) {
  const present = anchors.some((a) => a.href.includes(`cta=${cta}`));
  check(`Tracker present for cta="${cta}"`, present);
}

// Sanity: every tracker link goes through the edge function and carries a campaign
const trackerAnchors = anchors.filter((a) => a.href.includes("/functions/v1/track-email-click"));
check("All tracker links carry campaign param", trackerAnchors.every((a) => a.href.includes("campaign=")), `${trackerAnchors.length} tracker anchors`);
check("All tracker links carry to= destination", trackerAnchors.every((a) => /[?&]to=/.test(a.href)));

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

/* ── Render preview PNGs (desktop + mobile) ──────────────────────── */
// Most prospects open email on a phone first, so we render both widths
// to confirm the tour + walkthrough buttons stack and remain tappable.
// Serve the file over a tiny localhost HTTP server so Chromium parses
// it as text/html (file:// gets sniffed as text/plain in this sandbox).
const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/${basename(inputPath)}`;

const renders = [
  { label: "desktop", out: previewPath,        size: "680,3200" },
  { label: "mobile",  out: previewMobilePath,  size: "375,4200" }, // iPhone-ish width
];
for (const r of renders) {
  console.log(DIM(`\nRendering ${r.label} preview → ${r.out}`));
  try {
    execSync(
      `nix run nixpkgs#chromium -- --headless=new --disable-gpu --no-sandbox ` +
      `--hide-scrollbars --window-size=${r.size} --virtual-time-budget=2000 ` +
      `--screenshot=${r.out} ${url}`,
      { stdio: "pipe", timeout: 120_000 }
    );
    console.log(GREEN(`✓ ${r.label} preview written to ${r.out}`));
  } catch (err) {
    console.log(RED(`✗ ${r.label} preview render failed: ${err.message.split("\n")[0]}`));
    failures.push({ name: `Preview render (${r.label})`, detail: err.message.split("\n")[0] });
  }
}
server.close();

/* ── Exit code ───────────────────────────────────────────────────── */
process.exit(failures.length === 0 ? 0 : 1);