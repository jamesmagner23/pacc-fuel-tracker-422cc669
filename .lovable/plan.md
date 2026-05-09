## Unified CRM — `/crm`

A single CRM workspace shared by Admin + Operations, surfacing both prospects and existing customers on two boards (Acquisition for new sales, Retention for current customers). Email-only for v1 (uses your existing Gmail connector). Templates, activity log, and a "warn before double-contacting" guard included. SMS hook left as a later add-on.

---

### What gets built

**1. Navigation**
- New top-level sidebar item `CRM` (visible to admin + driver/ops roles).
- Removes the standalone Admin → Outreach tab and folds its functionality into CRM.
- Adds a CRM shortcut card to the Operations page.

**2. Two-board layout (one page, tab switcher)**
- **Acquisition board** — kanban of leads moving through `New → Contacted → Quoted → Won → Lost`. Lost cards capture a reason + optional follow-up date.
- **Retention board** — kanban of existing customers in `Active → At-risk → Churned`. "At-risk" auto-flag if no transactions in last 30 days (read-only signal alongside manual placement).
- Drag-and-drop between columns; each card shows org name, owner avatar, last contact, next follow-up, value indicator.

**3. Customer / Contact model**
- One CRM record per organisation. For existing clients, links to the `client_accounts` row so retention cards stay in sync (name, brand). Prospects live as standalone CRM records until converted (button: "Convert to client account").
- Each CRM record holds many contacts (name, role, email, phone, is_primary, do_not_contact).
- Tags, owner (user_id), source (referral / cold / inbound / etc.), notes (rich text), next-follow-up date, lost-reason.

**4. Communication**
- "Email" button on a contact opens the existing Gmail compose flow (reuses `send-via-gmail` + `email_templates`).
- Template picker pulls from `email_templates` and merges variables (contact.first_name, org, owner, portal link).
- Every send is logged into a unified `crm_activity` table (channel, subject, body excerpt, sent_by, gmail_message_id, thread_id, contact_id, customer_id).
- "Log call / Log SMS / Log meeting / Note" manual entry types so the activity timeline reflects everything (not just emails).
- **Double-contact warning**: when composing, if any teammate has emailed this contact in the last 7 days, the compose modal shows an amber banner ("Sarah emailed Tony 2 days ago — subject: …") but does not block. Configurable cooldown stored in a single `crm_settings` row.

**5. Templates**
- Reuses existing `email_templates` table (already there). CRM page gets a Templates tab — list, create, edit, preview with sample contact merge.
- Variables documented inline ({{contact.first_name}}, {{customer.name}}, {{owner.name}}, {{portal_url}}).

**6. Analytics dashboard (CRM → Insights tab)**
- Pipeline value & count by stage.
- Conversion rate New → Won (last 30/90 days).
- Win/loss breakdown with top lost-reasons.
- Activity volume per teammate (emails sent, calls logged) — last 14 days bar chart.
- "Quiet customers" widget: top 10 retention customers with longest gap since last contact.
- Reuses brand chart palette (orange line/bars, no black text).

**7. Permissions**
- Admin: full CRUD on everything.
- Driver/ops: read all, create activity + contacts, edit cards they own or are assigned to. Can't delete customers.
- Clients: no access (already gated by role routing).

---

### Data model (new tables)

```text
crm_customers
  id, kind ('prospect'|'client'), client_account_id (nullable FK→client_accounts),
  name, website, industry, source, owner_user_id, status ('active'|'archived'),
  acquisition_stage ('new'|'contacted'|'quoted'|'won'|'lost'),
  retention_stage  ('active'|'at_risk'|'churned'),
  lost_reason, next_follow_up_at, estimated_value, tags text[], notes,
  created_by, created_at, updated_at

crm_contacts
  id, customer_id FK, first_name, last_name, role, email, phone,
  is_primary bool, do_not_contact bool, notes, created_at, updated_at

crm_activities
  id, customer_id FK, contact_id FK nullable, user_id (sender),
  channel ('email'|'call'|'sms'|'meeting'|'note'),
  direction ('outbound'|'inbound'|'internal'),
  subject, body_excerpt, gmail_message_id, gmail_thread_id,
  outcome ('sent'|'replied'|'bounced'|'no_response'|null),
  occurred_at timestamptz, created_at

crm_settings  (single-row config)
  cooldown_days int default 7, default_owner_user_id, updated_at
```

RLS: admin = all; driver = select all + insert activities/contacts + update owned cards; nothing exposed to client role. Indexes on customer_id, occurred_at desc.

A trigger on `outreach_send_log` mirrors new Gmail sends into `crm_activities` when the recipient email matches a `crm_contacts.email`, so historical/external sends still surface in the timeline.

---

### Files to create / change

**New**
- `supabase/migrations/<ts>_crm_core.sql` — tables, RLS, trigger, seed `crm_settings` row.
- `src/pages/CRM.tsx` — page shell with tabs: Acquisition · Retention · Contacts · Templates · Insights.
- `src/components/crm/AcquisitionBoard.tsx`, `RetentionBoard.tsx` — kanban columns w/ drag.
- `src/components/crm/CustomerDrawer.tsx` — slide-out detail (overview, contacts, activity timeline, send-email).
- `src/components/crm/ContactList.tsx`, `ContactEditor.tsx`.
- `src/components/crm/ActivityTimeline.tsx`, `LogActivityDialog.tsx`.
- `src/components/crm/ComposeEmailDialog.tsx` — template picker + cooldown warning + Gmail send.
- `src/components/crm/CrmInsights.tsx` — 4–5 charts.
- `src/hooks/useCrmCustomers.ts`, `useCrmContacts.ts`, `useCrmActivities.ts`.

**Edited**
- `src/App.tsx` — route `/crm`.
- `src/components/Layout.tsx` — sidebar entry.
- `src/pages/Admin.tsx` — replace Outreach tab with a "CRM →" link card (deep-link to /crm Templates tab for the email templates section that already lived under Admin).
- `src/pages/Operations.tsx` — add CRM shortcut tile.
- `mem://index.md` + new `mem://features/crm` memory file.

---

### Out of scope for v1 (called out so we don't over-build)
- SMS sending (Twilio) — schema has `channel='sms'` ready for when you say go.
- Inbound email parsing (replies auto-attached to timeline) — relies on Gmail watch/push, can add after.
- Quotes integration on the customer card — easy to wire next pass to existing `quotes` table.
- Per-user notification settings (email me when a teammate contacts my customer).

Sound right? Hit approve and I'll build it.