ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS signup_source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS unblocked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_signup_source ON public.candidate_profiles(signup_source);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_state ON public.candidate_profiles(state);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_created_at ON public.candidate_profiles(created_at);