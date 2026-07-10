# Steph (driver) on Sales — plan

## 1. Buy-price display fixes (Price a Drop, everyone)

In `LiveDropCalculator.tsx`, upgrade the right-hand price panel:

- Big number stays inc-GST, add a smaller **"ex-GST $X.XXXX"** line directly under it (÷ 1.1).
- Move the effective date out of small caption text into a pill so it's obvious what date the buy price is for.
- Same treatment on the supplier picker buttons: show both inc and ex, plus the price_date, so it's clear whether Pro Fusion vs Pacific is priced for today.

## 2. Driver wage standardisation + OT toggle

Replace the free-typed `Driver $/hr` field with:

- Fixed baseline **$60/hr normal**.
- Toggle: **Normal ($60) / OT ($90, 1.5×)** — switches the number used in the truck-cost build-up.
- Admins keep the ability to override to a custom rate via a small "edit" affordance; drivers see the toggle only.

## 3. Driver role gets `/sales` (all three tabs)

- Routing (`src/App.tsx` `AuthGate`): allow driver on `/sales`, `/admin/pricing`, and required dependencies (client list read is already RLS-open to authenticated).
- Add a "Sales" button on `DriverPortal` so Steph can navigate in.
- Nothing hidden inside Sales — she sees Quote Builder, Price a Drop, Win Back (Full Sales tab, as chosen).

## 4. Driver guardrails on Price a Drop + Quote Builder

Rules (driver only):
- Litres must be **≥ 2,000 L**
- Payment terms must be **≤ 14 days**
- Margin must be **≥ 20%**

Behaviour when any rule fails:
- Yellow banner listing which rule(s) failed and the current value.
- Send / Save / Email actions swap for a **"Request admin approval"** button.
- Clicking it opens a small dialog: customer, litres, sell price, margin %, terms, driver note → inserts into a new `quote_approval_requests` table.
- If all rules pass, driver sends/saves as normal.

Admins are unaffected — they see the same warning but can still send.

## 5. Approval queue for admins

- New table `quote_approval_requests` (driver_id, customer_name, litres, buy_price_per_litre, sell_price_per_litre, margin_pct, payment_terms_days, driver_note, status: pending/approved/rejected, admin_note, decided_by, decided_at, timestamps).
- RLS: driver sees their own; admin sees all; driver inserts own; admin updates status.
- New **"Approvals"** tab on Sales (admin only) showing pending requests with Approve / Reject buttons + inline note.
- Small badge with pending count on the Admin sidebar Sales link.

## Technical notes

- New file: `src/components/sales/DriverGuardrails.tsx` — pure calc + banner, reused by Price a Drop and Quote Builder.
- New file: `src/components/sales/RequestApprovalDialog.tsx`.
- New file: `src/components/sales/ApprovalsTab.tsx`.
- New hook: `src/hooks/useQuoteApprovals.ts` (list, create, decide, pending-count).
- Migration: creates `quote_approval_requests`, GRANTs (authenticated + service_role, no anon), RLS policies using `has_role`, `updated_at` trigger.
- `useUserRole` already exists — reuse it to branch UI.
- Buy-price ex-GST is `price / 1.1` — both suppliers feed inc-GST per the file header comment.

## Out of scope

- No changes to the underlying quote/pricing math beyond wage.
- No email/SMS notification to admin on new approval request (in-app queue only). Can add later.
