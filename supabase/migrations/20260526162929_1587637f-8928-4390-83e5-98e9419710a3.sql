CREATE TABLE public.pending_meta_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  state text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at timestamptz
);

CREATE INDEX idx_pending_meta_oauth_states_state ON public.pending_meta_oauth_states(state);
CREATE INDEX idx_pending_meta_oauth_states_user ON public.pending_meta_oauth_states(user_id);

GRANT ALL ON public.pending_meta_oauth_states TO service_role;
GRANT SELECT, INSERT ON public.pending_meta_oauth_states TO authenticated;

ALTER TABLE public.pending_meta_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own oauth state"
ON public.pending_meta_oauth_states
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users read own oauth state"
ON public.pending_meta_oauth_states
FOR SELECT TO authenticated
USING (user_id = auth.uid());