
-- Outreach composer: add category + sort_order to email_templates,
-- and create segment_openers + outreach_log tables.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS email_templates_category_idx
  ON public.email_templates (category, sort_order);

-- ============================================================
-- segment_openers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.segment_openers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment text NOT NULL UNIQUE,
  opener text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.segment_openers TO authenticated;
GRANT ALL ON public.segment_openers TO service_role;
ALTER TABLE public.segment_openers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read segment openers"
  ON public.segment_openers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage segment openers"
  ON public.segment_openers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_segment_openers_updated
  BEFORE UPDATE ON public.segment_openers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- outreach_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_name text,
  to_email text,
  company text,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  category text,
  segment text,
  sell_price text,
  sent_via text NOT NULL,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_log_created_at_idx
  ON public.outreach_log (created_at DESC);

GRANT SELECT, INSERT ON public.outreach_log TO authenticated;
GRANT ALL ON public.outreach_log TO service_role;
ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read outreach log"
  ON public.outreach_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated insert outreach log"
  ON public.outreach_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sent_by);

-- ============================================================
-- Seed segment openers
-- ============================================================
INSERT INTO public.segment_openers (segment, opener, sort_order) VALUES
('Crane hire', 'Running cranes across multiple sites means a lot of diesel and a lot of chasing servos between jobs. We deliver straight to the machine so your operators stay on the hook, not at the bowser.', 10),
('Civil construction', 'On a civil job the fuel runs add up fast, especially when you''ve got plant spread across a site. We top up tanks and machines direct to plant so nothing sits idle waiting on fuel.', 20),
('Earthmoving', 'Excavators and dozers drink diesel and downtime on a moving job is money. We come to you on site, fill on the go, and docket every drop by machine.', 30),
('Concrete pumping/batching', 'Keeping pumps and agitators fuelled without pulling them off the pour is the headache. We deliver on site so you''re not sending trucks on fuel runs mid job.', 40),
('Agriculture', 'Tractors, harvesters, frost fans and on-farm tanks all run through serious diesel through season. We deliver bulk direct to your tanks so you''re not carting jerry cans or running into town.', 50),
('Transport/depot', 'A yard full of trucks burning through diesel is a standing fuel bill. We deliver to your depot tanks and docket it so you can track usage and claim your FTC cleanly.', 60)
ON CONFLICT (segment) DO NOTHING;

-- ============================================================
-- Seed outreach templates (plain-text only; html_body mirrors text_body wrapped in <pre>-style paragraphs).
-- We store the same content in html_body and text_body so existing editor works.
-- ============================================================
INSERT INTO public.email_templates (name, category, sort_order, subject, html_body, text_body, variables, default_values, is_active)
VALUES
(
  'Cold — Lead with the rate', 'cold', 10,
  'Bulk diesel for {{company}} sites, from {{sell_price}}',
$body$Hi {{first_name}},

{{segment_opener}}

James from PACC Energy. We run mobile diesel delivery direct to plant across Melbourne.

We're quoting bulk diesel from {{sell_price}} inc GST delivered straight to your machines and tanks. No servo runs, no fuel pods, no downtime for your crews.

That rate's on our 5,000L drops and we tier down from there, so even if your sites run lighter we'll usually still come in under what you're paying now.

Every drop comes with a docket so you can allocate fuel by machine and site, and we track your Fuel Tax Credits through our client portal.

Worth 5 minutes this week? Happy to put a tiered quote together against your actual usage.

Capability statement attached.

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
$body$Hi {{first_name}},

{{segment_opener}}

James from PACC Energy. We run mobile diesel delivery direct to plant across Melbourne.

We're quoting bulk diesel from {{sell_price}} inc GST delivered straight to your machines and tanks. No servo runs, no fuel pods, no downtime for your crews.

That rate's on our 5,000L drops and we tier down from there, so even if your sites run lighter we'll usually still come in under what you're paying now.

Every drop comes with a docket so you can allocate fuel by machine and site, and we track your Fuel Tax Credits through our client portal.

Worth 5 minutes this week? Happy to put a tiered quote together against your actual usage.

Capability statement attached.

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
'["first_name","company","sell_price","segment_opener"]'::jsonb, '{}'::jsonb, true
),
(
  'Cold — Lead with the saving', 'cold', 20,
  'Cutting the fuel runs on your {{company}} sites',
$body$Hi {{first_name}},

{{segment_opener}}

James from PACC Energy. We deliver bulk diesel direct to plant for civil, earthmoving and crane crews around Melbourne, so your machines get fuelled on site instead of sending operators on servo runs or juggling pods.

On price we're sharp. From {{sell_price}} on 5,000L drops, tiered down for smaller volumes, and we usually beat current supply either way.

You also get a docket on every drop for cost allocation by machine and site, plus Fuel Tax Credit tracking through our portal.

Can I send through a quote against your usage, or grab 5 minutes this week?

Capability statement attached.

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
$body$Hi {{first_name}},

{{segment_opener}}

James from PACC Energy. We deliver bulk diesel direct to plant for civil, earthmoving and crane crews around Melbourne, so your machines get fuelled on site instead of sending operators on servo runs or juggling pods.

On price we're sharp. From {{sell_price}} on 5,000L drops, tiered down for smaller volumes, and we usually beat current supply either way.

You also get a docket on every drop for cost allocation by machine and site, plus Fuel Tax Credit tracking through our portal.

Can I send through a quote against your usage, or grab 5 minutes this week?

Capability statement attached.

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
'["first_name","company","sell_price","segment_opener"]'::jsonb, '{}'::jsonb, true
),
(
  'Follow-up — Send the number', 'followup', 10,
  'PACC Energy pricing',
$body$Afternoon {{first_name}},

Good to chat the other day. As promised, here's where we land on diesel delivered direct to your sites.

From {{sell_price}} inc GST on 5,000L drops, and we tier from there based on your volumes.

Every drop comes with a docket so you can split fuel by machine and site, and we sort your Fuel Tax Credits through the portal too.

We look after Keller, Fulton Hogan, Icon and plenty of others, so you'd be in good company.

Happy to lock in a rate against your actual usage. Is there a number I can call to run through it?

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
$body$Afternoon {{first_name}},

Good to chat the other day. As promised, here's where we land on diesel delivered direct to your sites.

From {{sell_price}} inc GST on 5,000L drops, and we tier from there based on your volumes.

Every drop comes with a docket so you can split fuel by machine and site, and we sort your Fuel Tax Credits through the portal too.

We look after Keller, Fulton Hogan, Icon and plenty of others, so you'd be in good company.

Happy to lock in a rate against your actual usage. Is there a number I can call to run through it?

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
'["first_name","sell_price"]'::jsonb, '{}'::jsonb, true
),
(
  'Follow-up — Get them on the phone', 'followup', 20,
  'PACC Energy',
$body$Afternoon {{first_name}},

Good to chat the other day. I've got your pricing ready to go.

It varies a bit on volume and a couple of other factors, so easiest if I run you through it over the phone and tailor it to your sites rather than firing across a number that doesn't quite fit.

Quick background, we deliver direct to plant for Keller, Fulton Hogan, Icon and plenty of others. Docket on every drop and we track your Fuel Tax Credits through the portal.

What's a good number and time to give you a quick call this week?

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
$body$Afternoon {{first_name}},

Good to chat the other day. I've got your pricing ready to go.

It varies a bit on volume and a couple of other factors, so easiest if I run you through it over the phone and tailor it to your sites rather than firing across a number that doesn't quite fit.

Quick background, we deliver direct to plant for Keller, Fulton Hogan, Icon and plenty of others. Docket on every drop and we track your Fuel Tax Credits through the portal.

What's a good number and time to give you a quick call this week?

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
'["first_name"]'::jsonb, '{}'::jsonb, true
),
(
  'Win Back — Checking in', 'winback', 10,
  'PACC Energy — still here when you need us',
$body$Afternoon {{first_name}},

Been a while since we last sorted fuel for {{company}}. Thought I'd check in.

If your current supply's gone up or the servo runs are creeping back in, happy to put a fresh rate together against your current volumes. We're delivering direct to plant for Keller, Fulton Hogan, Icon and plenty of others.

Want me to send through a quick quote?

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
$body$Afternoon {{first_name}},

Been a while since we last sorted fuel for {{company}}. Thought I'd check in.

If your current supply's gone up or the servo runs are creeping back in, happy to put a fresh rate together against your current volumes. We're delivering direct to plant for Keller, Fulton Hogan, Icon and plenty of others.

Want me to send through a quick quote?

Thanks,
James Magner
Director
P. 0409 704 327
A. 3/7-9 Hamlet Street, Cheltenham VIC 3192$body$,
'["first_name","company"]'::jsonb, '{}'::jsonb, true
)
ON CONFLICT DO NOTHING;
