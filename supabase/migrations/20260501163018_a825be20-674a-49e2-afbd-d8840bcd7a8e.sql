
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  whatsapp_number TEXT,
  pix_key TEXT,
  pix_qr_url TEXT,
  pix_owner_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id) VALUES (1);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage settings"
ON public.app_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
