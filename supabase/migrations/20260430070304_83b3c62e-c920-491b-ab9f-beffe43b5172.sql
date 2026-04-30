UPDATE public.email_templates
SET html_body = REPLACE(html_body, 'c/L', 'C/L'),
    text_body = REPLACE(text_body, 'c/L', 'C/L')
WHERE id = '0e6ebb03-caf5-418f-af63-8b5961380c9b';