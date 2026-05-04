import { useEffect, useMemo, useState } from "react";

const EXPECTED = {
  background: "#0E1F10",
  accent: "#C8F26A",
  textPrimary: "#ECE4D2",
  positive: "#C8F26A",
  negative: "#FF6B5E",
  warning: "#F5C25B",
  themeColor: "#0E1F10",
  ogImage: "/og-image.jpg",
  manifest: "/manifest.json",
  favicon: "/favicon.ico",
  appleTouchIcon: "/apple-touch-icon.png",
  maskIcon: "/mask-icon.svg",
};

function normaliseHex(v: string): string {
  return v.trim().replace(/^["']|["']$/g, "").toLowerCase();
}

type Check = { label: string; expected: string; actual: string; ok: boolean };

export default function BrandCheck() {
  const [metaChecks, setMetaChecks] = useState<Check[]>([]);
  const [manifestChecks, setManifestChecks] = useState<Check[]>([]);

  const tokenChecks = useMemo<Check[]>(() => {
    const root = getComputedStyle(document.documentElement);
    const rows: [string, string][] = [
      ["--background", EXPECTED.background],
      ["--accent", EXPECTED.accent],
      ["--text-primary", EXPECTED.textPrimary],
      ["--positive", EXPECTED.positive],
      ["--negative", EXPECTED.negative],
      ["--warning", EXPECTED.warning],
    ];
    return rows.map(([token, expected]) => {
      const actual = normaliseHex(root.getPropertyValue(token));
      return { label: token, expected: expected.toLowerCase(), actual, ok: actual === expected.toLowerCase() };
    });
  }, []);

  useEffect(() => {
    const meta = (sel: string) =>
      (document.querySelector(sel) as HTMLMetaElement | HTMLLinkElement | null)?.getAttribute("content") ||
      (document.querySelector(sel) as HTMLLinkElement | null)?.getAttribute("href") ||
      "";

    const m: Check[] = [
      {
        label: "meta theme-color",
        expected: EXPECTED.themeColor.toLowerCase(),
        actual: normaliseHex(meta('meta[name="theme-color"]')),
        ok: false,
      },
      {
        label: "og:image",
        expected: EXPECTED.ogImage,
        actual: meta('meta[property="og:image"]') || "",
        ok: false,
      },
      {
        label: "favicon",
        expected: EXPECTED.favicon,
        actual: meta('link[rel="shortcut icon"], link[rel="icon"][type="image/x-icon"]'),
        ok: false,
      },
      {
        label: "apple-touch-icon",
        expected: EXPECTED.appleTouchIcon,
        actual: meta('link[rel="apple-touch-icon"]'),
        ok: false,
      },
      {
        label: "mask-icon",
        expected: EXPECTED.maskIcon,
        actual: meta('link[rel="mask-icon"]'),
        ok: false,
      },
      {
        label: "msapplication-TileColor",
        expected: EXPECTED.themeColor.toLowerCase(),
        actual: normaliseHex(meta('meta[name="msapplication-TileColor"]')),
        ok: false,
      },
    ].map((c) => ({ ...c, ok: c.actual.toLowerCase().includes(c.expected.toLowerCase()) }));

    setMetaChecks(m);

    fetch(EXPECTED.manifest)
      .then((r) => r.json())
      .then((mf) => {
        const checks: Check[] = [
          {
            label: "manifest theme_color",
            expected: EXPECTED.themeColor.toLowerCase(),
            actual: normaliseHex(mf.theme_color || ""),
            ok: normaliseHex(mf.theme_color || "") === EXPECTED.themeColor.toLowerCase(),
          },
          {
            label: "manifest background_color",
            expected: EXPECTED.background.toLowerCase(),
            actual: normaliseHex(mf.background_color || ""),
            ok: normaliseHex(mf.background_color || "") === EXPECTED.background.toLowerCase(),
          },
          {
            label: "manifest icons (192 + 512)",
            expected: "192x192 + 512x512",
            actual: (mf.icons || []).map((i: any) => i.sizes).join(", "),
            ok: (mf.icons || []).some((i: any) => i.sizes === "192x192") && (mf.icons || []).some((i: any) => i.sizes === "512x512"),
          },
        ];
        setManifestChecks(checks);
      })
      .catch(() =>
        setManifestChecks([
          { label: "manifest.json", expected: "fetchable", actual: "failed", ok: false },
        ])
      );
  }, []);

  const allChecks = [...tokenChecks, ...metaChecks, ...manifestChecks];
  const passing = allChecks.filter((c) => c.ok).length;
  const total = allChecks.length;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold uppercase tracking-tight">Brand Verification</h1>
        <p className="text-sm text-muted-foreground">
          Confirms theme tokens, meta tags, manifest, favicons, and chart palette match the PACC Energy brand.
        </p>
        <div className="text-sm font-medium" style={{ color: passing === total ? "var(--positive)" : "var(--warning)" }}>
          {passing} / {total} checks passing
        </div>
      </header>

      <Section title="Design Tokens" rows={tokenChecks} />
      <Section title="Meta Tags & Icons" rows={metaChecks} />
      <Section title="Manifest" rows={manifestChecks} />

      <Section
        title="Chart Palette Swatches"
        rows={[
          { label: "accent (series 1)", expected: EXPECTED.accent, actual: EXPECTED.accent, ok: true },
          { label: "warning (series 2)", expected: EXPECTED.warning, actual: EXPECTED.warning, ok: true },
          { label: "negative (alerts)", expected: EXPECTED.negative, actual: EXPECTED.negative, ok: true },
        ]}
        showSwatch
      />
    </div>
  );
}

function Section({ title, rows, showSwatch }: { title: string; rows: Check[]; showSwatch?: boolean }) {
  return (
    <section className="rounded-lg border border-surface-border bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">{title}</h2>
      <div className="divide-y divide-surface-border">
        {rows.length === 0 && <div className="text-xs text-muted-foreground py-2">Loading…</div>}
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              {showSwatch && (
                <span
                  className="inline-block w-4 h-4 rounded border border-surface-border"
                  style={{ background: r.actual }}
                />
              )}
              <span className="font-mono text-xs truncate">{r.label}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground font-mono">{r.actual || "—"}</span>
              <span
                className="px-2 py-0.5 rounded font-semibold uppercase tracking-wider"
                style={{
                  background: r.ok ? "var(--positive-bg)" : "var(--negative-bg)",
                  color: r.ok ? "var(--positive)" : "var(--negative)",
                }}
              >
                {r.ok ? "OK" : "FAIL"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}