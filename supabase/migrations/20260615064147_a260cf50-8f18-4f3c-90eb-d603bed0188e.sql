INSERT INTO public.email_templates (name, category, subject, text_body, html_body, sort_order, is_active)
VALUES (
  'Cold — Next-day delivered price',
  'cold',
  'Diesel delivered {{delivery_date}} — {{sell_price}} inc GST',
  E'Hi {{first_name}},\n\nJames from PACC Energy. Quick one — here''s our delivered diesel price for {{delivery_date}}:\n\n  {{sell_price}} inc GST  ({{sell_price_ex}} ex GST) per litre\n  Delivered direct to site on {{delivery_date}}\n\nHappy to lock it in, or give me a call on 0432 391 313 and we can talk through volumes, sites and a tiered rate.\n\nJames\nPACC Energy',
  '',
  0,
  true
);