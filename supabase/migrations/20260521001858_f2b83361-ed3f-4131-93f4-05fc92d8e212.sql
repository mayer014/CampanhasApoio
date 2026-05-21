-- ============ ENUMS ============
CREATE TYPE public.social_platform AS ENUM ('instagram','tiktok','facebook','youtube','twitter');
CREATE TYPE public.social_job_type AS ENUM ('crawl_profile','crawl_post');
CREATE TYPE public.social_job_status AS ENUM ('pending','running','done','failed');
CREATE TYPE public.social_log_level AS ENUM ('debug','info','warn','error','critical');
CREATE TYPE public.social_log_kind AS ENUM ('other','login_wall','rate_limit','captcha','network','parse','success');

-- ============ TABLES ============
CREATE TABLE public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  platform social_platform NOT NULL DEFAULT 'instagram',
  username text NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  followers_count integer,
  is_active boolean NOT NULL DEFAULT true,
  is_own boolean NOT NULL DEFAULT true,
  check_interval_minutes integer NOT NULL DEFAULT 360,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_errors integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, platform, username)
);
CREATE INDEX idx_social_profiles_active ON public.social_profiles (is_active, last_checked_at);

CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  external_id text NOT NULL,
  post_url text,
  caption text,
  thumbnail_url text,
  media_urls text[] NOT NULL DEFAULT '{}',
  hashtags text[] NOT NULL DEFAULT '{}',
  posted_at timestamptz,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  views integer DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, external_id)
);
CREATE INDEX idx_social_posts_candidate ON public.social_posts (candidate_id, posted_at DESC);

CREATE TABLE public.social_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  profile_id uuid REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  job_type social_job_type NOT NULL,
  status social_job_status NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  worker_id text,
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_jobs_queue ON public.social_jobs (status, scheduled_at, priority);

CREATE TABLE public.social_workers (
  worker_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'online',
  jobs_processed integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.social_worker_logs (
  id bigserial PRIMARY KEY,
  worker_id text,
  job_id uuid,
  profile_id uuid,
  level social_log_level NOT NULL DEFAULT 'info',
  kind social_log_kind NOT NULL DEFAULT 'other',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_logs_recent ON public.social_worker_logs (created_at DESC);

CREATE TABLE public.social_system_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  breaker_open boolean NOT NULL DEFAULT false,
  breaker_reason text,
  breaker_opened_at timestamptz,
  breaker_reset_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.social_system_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ RLS ============
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_worker_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_system_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp_admin_all ON public.social_profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY sp_owner_select ON public.social_profiles FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());
CREATE POLICY sp_owner_insert ON public.social_profiles FOR INSERT TO authenticated
  WITH CHECK (candidate_id = auth.uid());
CREATE POLICY sp_owner_update ON public.social_profiles FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid()) WITH CHECK (candidate_id = auth.uid());
CREATE POLICY sp_owner_delete ON public.social_profiles FOR DELETE TO authenticated
  USING (candidate_id = auth.uid());

CREATE POLICY spo_admin_all ON public.social_posts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY spo_owner_select ON public.social_posts FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

CREATE POLICY sj_admin_all ON public.social_jobs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY sw_admin_all ON public.social_workers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY swl_admin_all ON public.social_worker_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY sss_admin_all ON public.social_system_state FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ TRIGGERS ============
CREATE TRIGGER trg_social_profiles_touch BEFORE UPDATE ON public.social_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.claim_next_social_job(_worker_id text)
RETURNS TABLE (id uuid, job_type social_job_type, candidate_id uuid, profile_id uuid, payload jsonb, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _job_id uuid;
  _state public.social_system_state%ROWTYPE;
BEGIN
  SELECT * INTO _state FROM public.social_system_state WHERE id = 1;
  IF _state.breaker_open AND _state.breaker_reset_at IS NOT NULL AND _state.breaker_reset_at <= now() THEN
    UPDATE public.social_system_state
      SET breaker_open = false, breaker_reason = NULL, breaker_reset_at = NULL, updated_at = now()
      WHERE id = 1;
    _state.breaker_open := false;
  END IF;
  IF _state.breaker_open THEN RETURN; END IF;

  SELECT j.id INTO _job_id FROM public.social_jobs j
    WHERE j.status = 'pending' AND j.scheduled_at <= now()
    ORDER BY j.priority ASC, j.scheduled_at ASC
    LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF _job_id IS NULL THEN RETURN; END IF;

  UPDATE public.social_jobs
    SET status = 'running', started_at = now(), worker_id = _worker_id, attempts = attempts + 1
    WHERE social_jobs.id = _job_id;

  RETURN QUERY SELECT j.id, j.job_type, j.candidate_id, j.profile_id, j.payload, j.attempts
    FROM public.social_jobs j WHERE j.id = _job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_social_job(_job_id uuid, _ok boolean, _error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.social_jobs%ROWTYPE;
  _backoff integer;
BEGIN
  SELECT * INTO _row FROM public.social_jobs WHERE id = _job_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF _ok THEN
    UPDATE public.social_jobs SET status = 'done', finished_at = now(), error = NULL WHERE id = _job_id;
    IF _row.profile_id IS NOT NULL THEN
      UPDATE public.social_profiles
        SET last_checked_at = now(), last_success_at = now(), last_error = NULL, consecutive_errors = 0
        WHERE id = _row.profile_id;
    END IF;
  ELSE
    IF _row.attempts >= _row.max_attempts THEN
      UPDATE public.social_jobs SET status = 'failed', finished_at = now(), error = _error WHERE id = _job_id;
      IF _row.profile_id IS NOT NULL THEN
        UPDATE public.social_profiles
          SET last_checked_at = now(), last_error = _error, consecutive_errors = consecutive_errors + 1
          WHERE id = _row.profile_id;
      END IF;
    ELSE
      _backoff := LEAST(POWER(2, _row.attempts)::int * 5, 240);
      UPDATE public.social_jobs
        SET status = 'pending', scheduled_at = now() + (_backoff || ' minutes')::interval,
            error = _error, started_at = NULL, worker_id = NULL
        WHERE id = _job_id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_worker_heartbeat(_worker_id text, _status text, _jobs_processed integer, _last_error text, _meta jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.social_workers (worker_id, status, jobs_processed, last_error, meta, last_seen_at)
  VALUES (_worker_id, COALESCE(_status,'online'), COALESCE(_jobs_processed,0), _last_error, COALESCE(_meta,'{}'::jsonb), now())
  ON CONFLICT (worker_id) DO UPDATE
    SET status = EXCLUDED.status, jobs_processed = EXCLUDED.jobs_processed,
        last_error = EXCLUDED.last_error, meta = EXCLUDED.meta, last_seen_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_due_social_profiles()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
  INSERT INTO public.social_jobs (candidate_id, profile_id, job_type, priority)
  SELECT p.candidate_id, p.id, 'crawl_profile', CASE WHEN p.is_own THEN 10 ELSE 100 END
  FROM public.social_profiles p
  WHERE p.is_active AND p.consecutive_errors < 5
    AND (p.last_checked_at IS NULL OR p.last_checked_at < now() - (p.check_interval_minutes || ' minutes')::interval)
    AND NOT EXISTS (
      SELECT 1 FROM public.social_jobs j
      WHERE j.profile_id = p.id AND j.status IN ('pending','running')
    );
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'jobs', (SELECT COALESCE(jsonb_object_agg(status, c), '{}'::jsonb) FROM (
      SELECT status::text, COUNT(*) c FROM public.social_jobs GROUP BY status) s),
    'workers_online', (SELECT COUNT(*) FROM public.social_workers WHERE last_seen_at > now() - interval '2 minutes'),
    'workers_total', (SELECT COUNT(*) FROM public.social_workers),
    'workers', (SELECT COALESCE(jsonb_agg(row_to_json(w) ORDER BY w.last_seen_at DESC), '[]'::jsonb) FROM (
      SELECT worker_id, status, last_seen_at, jobs_processed, last_error,
        (last_seen_at > now() - interval '2 minutes') AS is_online
      FROM public.social_workers ORDER BY last_seen_at DESC LIMIT 20) w),
    'profiles_active', (SELECT COUNT(*) FROM public.social_profiles WHERE is_active),
    'profiles_total', (SELECT COUNT(*) FROM public.social_profiles),
    'posts_today', (SELECT COUNT(*) FROM public.social_posts WHERE first_seen_at > date_trunc('day', now())),
    'posts_total', (SELECT COUNT(*) FROM public.social_posts),
    'recent_errors', (SELECT COALESCE(jsonb_agg(row_to_json(l) ORDER BY l.created_at DESC), '[]'::jsonb) FROM (
      SELECT id, created_at, worker_id, level, kind, message FROM public.social_worker_logs
      WHERE level IN ('warn','error','critical') ORDER BY created_at DESC LIMIT 30) l),
    'breaker', (SELECT row_to_json(s) FROM public.social_system_state s WHERE s.id = 1)
  ) INTO _result;
  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_next_social_job(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_social_job(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.social_worker_heartbeat(text, text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_due_social_profiles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_dashboard_stats() TO authenticated;