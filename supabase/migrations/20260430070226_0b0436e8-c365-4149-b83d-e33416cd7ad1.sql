UPDATE public.email_templates
SET html_body = REPLACE(REPLACE(html_body, 'Diesel · 10ppm', 'Diesel'), 'Bulk delivered, ex-GST', 'Delivered, ex-GST'),
    text_body = REPLACE(REPLACE(text_body, 'Diesel · 10ppm', 'Diesel'), 'Bulk delivered, ex-GST', 'Delivered, ex-GST')
WHERE id = '0e6ebb03-caf5-418f-af63-8b5961380c9b';