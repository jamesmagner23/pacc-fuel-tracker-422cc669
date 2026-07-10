
# Unified Sales pricing engine

Goal: one shared pricing engine used by Quote Builder + Price a Drop, driven by **% of sell** (true GP), volume tiers, and payment-term floors — with role-based UI, validation, owner BCC, and full activity logging.

## 1. Shared pricing utility — `src/lib/pricing.ts` (new)

Single source of truth. Both tabs import from here. No pricing math duplicated in components.

Exports:
- `VOLUME_TIERS` — the ladder below.
- `TERM_FLOORS` — payment-term → floor % of sell + behaviour flag (`ok` / `warn` / `blocked`).
- `ABSOLUTE_FLOOR_PCT = 0.08`.
- `tierForLitres(litres)` → tier row (or `custom` sentinel for ≥10,000).
- `floorForTerms({ litres, termsDays, tierTargetPct, clientEstablished })` → resolved floor % of sell, plus reason.
- `computeSell({ buy, targetPct })` → `buy / (1 - targetPct)`.
- `computeFromCentsPerL({ buy, cpl })` → `buy + cpl/100`.
- `deriveMetrics({ buy, sell, litres, truckCost })` → `{ gpPct, markupPct, cplMargin, grossMargin$, contribution$ }`.
- `validateLineItem({ buy, sell })` → `{ ok, reason }` (sell < buy → below cost; sell > 5×buy → junk).
- `priceStatus({ buy, sell, gpPct, floorPct, termsDays, litres, clientEstablished })` → `{ level: 'green'|'amber'|'red'|'blocked', message, canSend }`.

Volume tier ladder (% of sell):

| Litres | Target GP % | Approx markup |
|---|---|---|
| 0–500 | 26 | +35% |
| 500–1,000 | 23 | +30% |
| 1,000–2,500 | 20 | +25% |
| 2,500–5,000 | 17 | +21% |
| 5,000–7,500 | 15 | +18% |
| 7,500–10,000 | 13 | +15% |
| ≥10,000 | custom (blocked, "Call James") | — |

Term floors (only unlock below tier target when litres ≥ 2,500 AND `clientEstablished`):

| Terms | Floor GP % | Behaviour |
|---|---|---|
| COD/prepay | 8 | ok |
| 7d | 10 | ok |
| 14d | 12 | ok |
| 21d | tier target | ok |
| 30d | tier target | amber "Past cash-flow window. Call James before sending." |
| 45d | — | blocked, "Beyond supply terms. Approval required." |
| 60d | — | blocked, same |

Absolute floor 8% always. If a user types below floor → clamp up + inline warning naming the floor.

Guards:
- `gpPct < 8` → red, block send, "Below floor. Call James."
- `sell < buy` → red, block, "Below cost."
- `markupPct > 60` → amber "Above normal range, confirm before sending" (no block).

## 2. Role helper reuse

Use existing `useUserRole`. Map: `admin` → full; `driver` (== rep, Steph) → rep view; anything else default admin so owner isn't locked out. Existing `client` role stays on portal (untouched).

Rep view masks: named supplier ("Pacific" / "Pro Fusion") and the supplier picker — auto-select cheapest, show single unlabelled "buy" figure. Rep still sees margin, tier, floor, contribution, truck cost, status pill, and CAN walk margin to the floor. Hard floors apply to rep with no override; admin gets a confirm-dialog override that logs.

## 3. Price a Drop (`LiveDropCalculator.tsx`)

- Import from `pricing.ts`; delete inline formulas.
- Auto-select tier when litres change; set target-margin field to tier %.
- Wire payment-terms select into floor logic; show current floor + reason inline.
- Margin control is % of sell (headline). Show markup % and c/L as secondary.
- Add `clientEstablished` toggle (default off = new client) with helper text.
- Status pill (green/amber/red/blocked) drives whether "Email this rate" enables.
- Owner-override button (admin only, when blocked by soft rules) → confirm dialog → allows send, logged with `override_by`.
- Rep view: hide supplier name + supplier toggle; auto-pick cheapest; keep everything else.

## 4. Quote Builder (`PricingTab.tsx` + `useQuotes.ts`)

- Import from `pricing.ts`.
- Each line item: auto-tier by its litres, apply that tier's target margin (fixes flat-margin bug).
- Validate before create/email: reject unit sell > 5× buy or < buy; block ≥10,000 L without admin override; enforce term floor.
- Quotes list: add small red flag icon next to any row where unit price out of band OR `valid_until < today`. Flag only — no auto-delete.
- Replace existing driver-guardrail banner with the unified `PriceStatusBanner` driven by `priceStatus()`.

## 5. Display consistency (both tabs)

Fixed order in results panel:
1. Delivered sell $/L inc GST (headline)
2. "X% GP" (true margin, headline)
3. "markup Y% · Z c/L" (secondary)
4. Total quote $ inc GST
5. Contribution $ (GP $ − truck cost) + repeat GP% and c/L
6. Payment terms + cash-flow-window indicator

Default supplier = cheapest (BEST). Manual toggle and manual buy-price override kept (admin only).

## 6. Owner BCC + activity logging

- Every outbound Sales email (`send-quote` edge function + any "Email this rate" call) auto-BCCs `jmagner@paccenergy.com`. Silent, not an approval step.
- New table `sales_activity`: `rep_id`, `client_name`, `litres`, `terms_days`, `sell_price_per_litre`, `gp_pct`, `status` (`drafted|sent|accepted|rejected|expired|overridden`), `metadata jsonb`, `created_at`.
- Log on: quote created, quote sent, rate emailed, admin override used.
- RLS: rep sees own; admin sees all. GRANTs + RLS per project convention.

## 7. Win Back fix (`WinBackTab.tsx`)

- Historical revenue = Σ (delivered_litres × sell_price_on_that_date) using `customer_pricing` / quotes where available.
- If no rate record exists, render "no rate on file" instead of "$0 rev".

## 8. Acceptance checks

Verify against Pacific $1.7752 inc GST:
- 500 L auto → 26% GP → $2.399/L
- 500 L @ 20% → $2.219/L
- Quote Builder vs Price a Drop: identical sell for same inputs
- 5,000 L @ 21d: floor = 15%; @14d: 12%; @7d: 10%; @COD: 8%; typing 6% clamps to 8%
- 5,000 L @ 45d: send blocked
- 12,000 L: blocked as custom
- Line at $45,260/L: rejected
- Rep view walks to floor, no named supplier shown, no override

## Out of scope (unchanged)

Client portal, Finance/P&L pages, auth flow, routing, TGP benchmark, supplier buy-price toggle mechanics, existing "Email this rate/quote" actions (only BCC + log added), quotes list structure, Win Back list structure.

## Technical notes

- New: `src/lib/pricing.ts`, `src/components/sales/PriceStatusBanner.tsx` (replaces `DriverGuardrailBanner`), migration for `sales_activity`.
- Edit: `LiveDropCalculator.tsx`, `PricingTab.tsx`, `useQuotes.ts` (line validation), `WinBackTab.tsx`, `send-quote` edge function (BCC + log), `Sales.tsx` (nothing structural; badge already there).
- `quote_approval_requests` (from previous work) stays for the hard-blocked-request flow.
- Keep `DriverGuardrailBanner.tsx` deleted-or-wrapper for compatibility.
