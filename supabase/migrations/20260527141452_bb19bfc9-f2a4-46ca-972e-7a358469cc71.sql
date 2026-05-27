CREATE TABLE public.social_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  period text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (connection_id, cache_key, period)
);

CREATE INDEX idx_sic_user ON public.social_insights_cache(user_id);
CREATE INDEX idx_sic_expires ON public.social_insights_cache(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_insights_cache TO authenticated;
GRANT ALL ON public.social_insights_cache TO service_role;

ALTER TABLE public.social_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sic_owner_all" ON public.social_insights_cache
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sic_admin_all" ON public.social_insights_cache
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));