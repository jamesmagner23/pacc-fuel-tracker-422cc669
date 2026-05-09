## Goal

Add two sub-tabs to **Market Intelligence** (`/market`) — keep `/suppliers` untouched.

1. **BOWSER AVG** — Melbourne metro average retail diesel (what trucks pay at the pump)
2. **TGP COMPARE** — Melbourne terminal gate prices side-by-side across brands

Both default to last 7 days, Inc/Ex GST toggle.

---

## 1. BOWSER AVG — Melbourne retail diesel

**Two data sources merged on one chart:**

- **AIP weekly retail** (trusted baseline, weekly, ex-GST → convert) — scrape `https://www.aip.com.au/pricing/retail-diesel`, store as `source='AIP_Retail'`, `location='Melbourne'`
- **PetrolSpy daily aggregator** (live signal, daily) — call PetrolSpy API for diesel stations within Melbourne metro bounding box, compute mean price, store as `source='PetrolSpy'`, `location='Melbourne'`

**New table** `retail_bowser_prices`:
- `price_date date`, `source text`, `location text`, `product text` (default `'Diesel'`), `price_inc_gst numeric`, `sample_size integer`, `notes text`
- Unique on `(price_date, location, product, source)`
- RLS: admins manage, authenticated read

**New edge function** `fetch-retail-bowser`:
- Fetches both sources, upserts daily
- Scheduled via `pg_cron` daily at 09:00 UTC
- Bonus: also pulls **driver intake** average (`fuel_intake_logs.bowser_retail_price`) by date — already in DB, no scrape needed; chart renders this as a third line straight from existing data

**UI on BOWSER AVG tab:**
- 3-line chart: AIP weekly · PetrolSpy daily · Our actual driver fills
- KPI tiles: today's avg, 7-day avg, vs our buy price spread
- Inc/Ex GST toggle, 7d / 30d / 90d range

---

## 2. TGP COMPARE — Melbourne, all brands

Existing `terminal_gate_prices` already has `source` column. Today it stores `AIP` (city-average) and `Viva` (brand-specific). To compare brands properly we need each major's published TGP.

**Brand scrapers** (all Melbourne diesel, store with `source='<Brand>'`, `location='Melbourne'`):
- **Viva** — already scraped daily by `fetch-viva-tgp`
- **Ampol** — extend with `fetch-ampol-tgp`: scrapes `https://www.ampol.com.au/about-ampol/fuel-pricing/terminal-gate-pricing`
- **BP** — `fetch-bp-tgp`: scrapes `https://www.bp.com/en_au/australia/home/products-and-services/bp-fuels/fuel-pricing.html`
- **Mobil** — `fetch-mobil-tgp`: scrapes Mobil Australia TGP page
- **7-Eleven** — `fetch-711-tgp`: scrapes 7-Eleven TGP page
- All use `r.jina.ai` proxy (same trick as Viva) to avoid CDN blocks
- All scheduled daily 20:15 UTC via `pg_cron`

Keep existing AIP city-avg as a "market" reference line.

**UI on TGP COMPARE tab:**
- Multi-line chart: one line per brand, AIP city-avg as dashed reference
- Today snapshot: tile per brand with current price + delta vs city avg + cheapest highlighted in green
- 7d default range, Inc/Ex GST toggle (data stored ex-GST)
- Empty-state per brand if scrape hasn't landed yet (don't fail loudly)

---

## Scope I'm NOT doing in this pass
- Other cities (you said Melbourne only)
- Per-station retail breakdown (only city avg)
- Historical backfill — charts grow as scrapers run forward

---

## Technical Details

**Files to add**
- Migration: `retail_bowser_prices` table + RLS
- Edge functions: `fetch-retail-bowser`, `fetch-ampol-tgp`, `fetch-bp-tgp`, `fetch-mobil-tgp`, `fetch-711-tgp`
- `pg_cron` schedules (insert tool, not migration — contains anon key)
- Hook: `useRetailBowserPrices.ts`
- Tab components: `MarketBowserAvgTab.tsx`, `MarketTGPCompareTab.tsx`
- Wire into `MarketIntelligence.tsx` tabs array

**Files to edit**
- `src/pages/MarketIntelligence.tsx` — add 2 tabs

**Risk**: brand TGP pages may change HTML/block scrapers. The `r.jina.ai` markdown proxy pattern (already proven for Viva) handles most cases. Each scraper logs to a `scrape_attempts`-style audit so failures are visible.
