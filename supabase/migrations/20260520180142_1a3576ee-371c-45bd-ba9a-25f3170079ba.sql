
-- ENUMS
CREATE TYPE public.social_profile_type AS ENUM ('own_profile','competitor','portal','influencer');
CREATE TYPE public.social_platform AS ENUM ('instagram');
CREATE TYPE public.social_post_type AS ENUM ('feed','reel','carousel','story');
CREATE TYPE public.social_job_status AS ENUM ('pending','running','done','failed');
CREATE TYPE public.social_job_type AS ENUM ('crawl_profile','crawl_post');
CREATE TYPE public.social_alert_type AS ENUM ('viral_post','competitor_growth');
CREATE TYPE public.social_alert_severity AS ENUM ('info','warning','critical');

-- PROFILES
CREATE TABLE public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  platform public.social_platform NOT NULL DEFAULT 'instagram',
  username text NOT NULL,
  profile_type public.social_profile_type NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  followers_count integer,
  is_active boolean NOT NULL DEFAULT true,
  check_interval_minutes integer NOT NULL DEFAULT 360,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_errors integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_profiles_username_chk CHECK (username ~ '^[A-Za-z0-9_.]{1,30}$'),
  CONSTRAINT social_profiles_interval_chk CHECK (check_interval_minutes BETWEEN 30 AND 10080),
  UNIQUE (candidate_id, platform, username)
);
CREATE INDEX idx_social_profiles_candidate ON public.social_profiles (candidate_id);
CREATE INDEX idx_social_profiles_due ON public.social_profiles (last_checked_at) WHERE is_active;

-- POSTS
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  post_type public.social_post_type NOT NULL DEFAULT 'feed',
  caption text,
  hashtags text[] NOT NULL DEFAULT '{}',
  mentions text[] NOT NULL DEFAULT '{}',
  media_urls text[] NOT NULL DEFAULT '{}',
  thumbnail_url text,
  posted_at timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  UNIQUE (profile_id, external_id)
);
CREATE INDEX idx_social_posts_candidate_posted ON public.social_posts (candidate_id, posted_at DESC);
CREATE INDEX idx_social_posts_profile_posted ON public.social_posts (profile_id, posted_at DESC);
CREATE INDEX idx_social_posts_hashtags ON public.social_posts USING GIN (hashtags);

-- SNAPSHOTS
CREATE TABLE public.social_post_snapshots (
  id bigserial PRIMARY KEY,
  candidate_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  likes integer,
  comments integer,
  views integer,
  engagement_rate numeric(6,4),
  growth_velocity numeric(10,2)
);
CREATE INDEX idx_social_snapshots_post ON public.social_post_snapshots (post_id, captured_at DESC);
CREATE INDEX idx_social_snapshots_candidate ON public.social_post_snapshots (candidate_id, captured_at DESC);

-- JOBS QUEUE
CREATE TABLE public.social_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  profile_id uuid REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  job_type public.social_job_type NOT NULL,
  status public.social_job_status NOT NULL DEFAULT 'pending',
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
CREATE INDEX idx_social_jobs_pending ON public.social_jobs (priority, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_social_jobs_candidate ON public.social_jobs (candidate_id, created_at DESC);

-- ALERTS
CREATE TABLE public.social_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  alert_type public.social_alert_type NOT NULL,
  severity public.social_alert_severity NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_id uuid REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  is_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_alerts_inbox ON public.social_alerts (candidate_id, created_at DESC) WHERE NOT is_dismissed;

-- updated_at trigger
CREATE TRIGGER touch_social_profiles BEFORE UPDATE ON public.social_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_alerts ENABLE ROW LEVEL SECURITY;

-- social_profiles policies
CREATE POLICY sp_admin_all ON public.social_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY sp_owner_select ON public.social_profiles FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());
CREATE POLICY sp_owner_insert ON public.social_profiles FOR INSERT TO authenticated
  WITH CHECK (candidate_id = auth.uid());
CREATE POLICY sp_owner_update ON public.social_profiles FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid()) WITH CHECK (candidate_id = auth.uid());
CREATE POLICY sp_owner_delete ON public.social_profiles FOR DELETE TO authenticated
  USING (candidate_id = auth.uid());

-- social_posts (read-only for owner; writes via service role from ingest)
CREATE POLICY spo_admin_all ON public.social_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY spo_owner_select ON public.social_posts FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- snapshots
CREATE POLICY sps_admin_all ON public.social_post_snapshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY sps_owner_select ON public.social_post_snapshots FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- jobs (only admin / service role; candidates não precisam ler)
CREATE POLICY sj_admin_all ON public.social_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- alerts
CREATE POLICY sa_admin_all ON public.social_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY sa_owner_select ON public.social_alerts FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());
CREATE POLICY sa_owner_update ON public.social_alerts FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid()) WITH CHECK (candidate_id = auth.uid());

-- ============================================================
-- RPC: claim_next_social_job (FOR UPDATE SKIP LOCKED + dedupe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_social_job(_worker_id text)
RETURNS TABLE (
  id uuid,
  job_type public.social_job_type,
  candidate_id uuid,
  profile_id uuid,
  post_id uuid,
  payload jsonb,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job_id uuid;
BEGIN
  SELECT j.id INTO _job_id
  FROM public.social_jobs j
  WHERE j.status = 'pending'
    AND j.scheduled_at <= now()
  ORDER BY j.priority ASC, j.scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.social_jobs
  SET status = 'running',
      started_at = now(),
      worker_id = _worker_id,
      attempts = attempts + 1
  WHERE social_jobs.id = _job_id;

  RETURN QUERY
  SELECT j.id, j.job_type, j.candidate_id, j.profile_id, j.post_id, j.payload, j.attempts
  FROM public.social_jobs j
  WHERE j.id = _job_id;
END;
$$;

-- ============================================================
-- RPC: complete_social_job
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_social_job(_job_id uuid, _ok boolean, _error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.social_jobs%ROWTYPE;
  _backoff integer;
BEGIN
  SELECT * INTO _row FROM public.social_jobs WHERE id = _job_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF _ok THEN
    UPDATE public.social_jobs
    SET status = 'done', finished_at = now(), error = NULL
    WHERE id = _job_id;

    IF _row.profile_id IS NOT NULL AND _row.job_type = 'crawl_profile' THEN
      UPDATE public.social_profiles
      SET last_checked_at = now(),
          last_success_at = now(),
          last_error = NULL,
          consecutive_errors = 0
      WHERE id = _row.profile_id;
    END IF;
  ELSE
    IF _row.attempts >= _row.max_attempts THEN
      UPDATE public.social_jobs
      SET status = 'failed', finished_at = now(), error = _error
      WHERE id = _job_id;

      IF _row.profile_id IS NOT NULL THEN
        UPDATE public.social_profiles
        SET last_checked_at = now(),
            last_error = _error,
            consecutive_errors = consecutive_errors + 1
        WHERE id = _row.profile_id;
      END IF;
    ELSE
      _backoff := LEAST(POWER(2, _row.attempts)::int * 5, 240); -- minutos
      UPDATE public.social_jobs
      SET status = 'pending',
          scheduled_at = now() + (_backoff || ' minutes')::interval,
          error = _error,
          started_at = NULL,
          worker_id = NULL
      WHERE id = _job_id;
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- RPC: enqueue_due_social_profiles (chamado por pg_cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_due_social_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  INSERT INTO public.social_jobs (candidate_id, profile_id, job_type, priority)
  SELECT p.candidate_id, p.id, 'crawl_profile',
         CASE p.profile_type WHEN 'own_profile' THEN 10 ELSE 100 END
  FROM public.social_profiles p
  WHERE p.is_active
    AND p.consecutive_errors < 5
    AND (p.last_checked_at IS NULL
         OR p.last_checked_at < now() - (p.check_interval_minutes || ' minutes')::interval)
    AND NOT EXISTS (
      SELECT 1 FROM public.social_jobs j
      WHERE j.profile_id = p.id AND j.status IN ('pending','running')
    );
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
