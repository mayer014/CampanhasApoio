CREATE TABLE public.socialapi_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.socialapi_oauth_states TO authenticated;
GRANT ALL ON public.socialapi_oauth_states TO service_role;

ALTER TABLE public.socialapi_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sos_owner_select" ON public.socialapi_oauth_states
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sos_owner_insert" ON public.socialapi_oauth_states
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sos_owner_delete" ON public.socialapi_oauth_states
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_socialapi_oauth_states_user ON public.socialapi_oauth_states(user_id);
CREATE INDEX idx_socialapi_oauth_states_created ON public.socialapi_oauth_states(created_at);