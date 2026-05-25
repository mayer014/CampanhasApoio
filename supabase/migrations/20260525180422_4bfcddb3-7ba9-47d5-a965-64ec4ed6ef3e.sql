CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'meta',
  access_token text,
  page_id text,
  instagram_business_id text,
  page_name text,
  page_picture_url text,
  instagram_username text,
  instagram_picture_url text,
  status text NOT NULL DEFAULT 'disconnected',
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX social_connections_user_platform_idx
  ON public.social_connections(user_id, platform);

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc_owner_select" ON public.social_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sc_owner_insert" ON public.social_connections
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sc_owner_update" ON public.social_connections
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sc_owner_delete" ON public.social_connections
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sc_admin_all" ON public.social_connections
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();