UPDATE public.email_templates
SET html_body = REPLACE(
                  REPLACE(
                    REPLACE(html_body,
                      'Victorian-based bulk fuel supplier delivering diesel direct to site.
            Backed by Ampol supply, modern tanker fleet and a live data portal that shows every
            litre, every site, every machine',
                      'National fuel supplier delivering diesel direct to site, backed by a modern
            tanker fleet and a live data portal that shows every litre, every site,
            every machine'),
                    'Final invoiced price confirmed on delivery. {{extra_terms}}',
                    'Final invoiced price confirmed on delivery.'),
                  'Reliable fuel supply with the data layer built in.',
                  'Fuel supply, with the data built in.'),
    text_body = REPLACE(
                  REPLACE(
                    REPLACE(text_body,
                      'Victorian-based bulk fuel supplier',
                      'National fuel supplier'),
                    'Backed by Ampol supply, modern tanker fleet',
                    'Backed by a modern tanker fleet'),
                  'Reliable fuel supply with the data layer built in.',
                  'Fuel supply, with the data built in.')
WHERE id = '0e6ebb03-caf5-418f-af63-8b5961380c9b';

UPDATE public.email_templates
SET text_body = REPLACE(text_body, '{{extra_terms}}', '')
WHERE id = '0e6ebb03-caf5-418f-af63-8b5961380c9b';