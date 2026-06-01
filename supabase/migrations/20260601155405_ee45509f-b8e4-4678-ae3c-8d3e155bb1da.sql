-- Update portal_missions to support multi-platform links and custom WA templates
ALTER TABLE public.portal_missions ALTER COLUMN post_url DROP NOT NULL;
ALTER TABLE public.portal_missions ADD COLUMN fb_post_url text;
ALTER TABLE public.portal_missions ADD COLUMN ig_post_url text;
ALTER TABLE public.portal_missions ADD COLUMN whatsapp_template text;
