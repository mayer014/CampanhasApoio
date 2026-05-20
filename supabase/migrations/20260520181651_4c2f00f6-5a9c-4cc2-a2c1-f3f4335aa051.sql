
-- =========================
-- Workers (heartbeat)
-- =========================
CREATE TABLE IF NOT EXISTS public.social_workers (
  worker_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'online',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  jobs_processed integer NOT NULL DEFAULT 0,
  last_error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY sw_admin_all ON public.social_workers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_social_workers_last_seen ON public.social_workers(last_seen_at DESC);

-- =========================
-- Worker logs
-- =========================
DO $$ BEGIN
  CREATE TYPE social_log_level AS ENUM ('debug','info','warn','error','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE social_log_kind AS ENUM (
    'login_wall','rate_limit','timeout','parser_failure',
    'ingest_failure','network_error','captcha','breaker','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.social_worker_logs (
  id bigserial PRIMARY KEY,
  worker_id text,
  profile_id uuid,
  job_id uuid,
  level social_log_level NOT NULL DEFAULT 'info',
  kind social_log_kind NOT NULL DEFAULT 'other',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_worker_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY swl_admin_all ON public.social_worker_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_swl_created ON public.social_worker_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swl_kind ON public.social_worker_logs(kind, created_at DESC);

-- =========================
-- System state (circuit breaker)
-- =========================
CREATE TABLE IF NOT EXISTS public.social_system_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  breaker_open boolean NOT NULL DEFAULT false,
  breaker_reason text,
  breaker_opened_at timestamptz,
  breaker_reset_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.social_system_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.social_system_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY sss_admin_all ON public.social_system_state
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =========================
-- claim_next_social_job: respeitar breaker + auto-reset
-- =========================
CREATE OR REPLACE FUNCTION public.claim_next_social_job(_worker_id text)
RETURNS TABLE(id uuid, job_type social_job_type, candidate_id uuid, profile_id uuid, post_id uuid, payload jsonb, attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _job_id uuid;
  _state public.social_system_state%ROWTYPE;
BEGIN
  SELECT * INTO _state FROM public.social_system_state WHERE id = 1;

  -- Auto reset se passou da janela
  IF _state.breaker_open AND _state.breaker_reset_at IS NOT NULL AND _state.breaker_reset_at <= now() THEN
    UPDATE public.social_system_state
      SET breaker_open = false, breaker_reason = NULL, breaker_reset_at = NULL, updated_at = now()
      WHERE id = 1;
    _state.breaker_open := false;
  END IF;

  IF _state.breaker_open THEN
    RETURN;
  END IF;

  SELECT j.id INTO _job_id
  FROM public.social_jobs j
  WHERE j.status = 'pending' AND j.scheduled_at <= now()
  ORDER BY j.priority ASC, j.scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _job_id IS NULL THEN RETURN; END IF;

  UPDATE public.social_jobs
  SET status = 'running', started_at = now(), worker_id = _worker_id, attempts = attempts + 1
  WHERE social_jobs.id = _job_id;

  RETURN QUERY
  SELECT j.id, j.job_type, j.candidate_id, j.profile_id, j.post_id, j.payload, j.attempts
  FROM public.social_jobs j WHERE j.id = _job_id;
END;
$function$;

-- =========================
-- Heartbeat upsert
-- =========================
CREATE OR REPLACE FUNCTION public.social_worker_heartbeat(
  _worker_id text,
  _status text,
  _jobs_processed integer,
  _last_error text,
  _meta jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.social_workers (worker_id, status, jobs_processed, last_error, meta, last_seen_at, updated_at)
  VALUES (_worker_id, COALESCE(_status,'online'), COALESCE(_jobs_processed,0), _last_error, COALESCE(_meta,'{}'::jsonb), now(), now())
  ON CONFLICT (worker_id) DO UPDATE
    SET status = EXCLUDED.status,
        jobs_processed = EXCLUDED.jobs_processed,
        last_error = EXCLUDED.last_error,
        meta = EXCLUDED.meta,
        last_seen_at = now(),
        updated_at = now();
END;
$$;

-- =========================
-- Circuit breaker auto-trip a partir de logs recentes
-- =========================
CREATE OR REPLACE FUNCTION public.social_evaluate_breaker()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bad integer;
  _state public.social_system_state%ROWTYPE;
BEGIN
  SELECT * INTO _state FROM public.social_system_state WHERE id = 1;
  IF _state.breaker_open THEN RETURN true; END IF;

  SELECT COUNT(*) INTO _bad
  FROM public.social_worker_logs
  WHERE created_at > now() - interval '10 minutes'
    AND kind IN ('login_wall','rate_limit','captcha');

  IF _bad >= 10 THEN
    UPDATE public.social_system_state
      SET breaker_open = true,
          breaker_reason = format('Auto-trip: %s eventos críticos em 10 min', _bad),
          breaker_opened_at = now(),
          breaker_reset_at = now() + interval '60 minutes',
          updated_at = now()
      WHERE id = 1;

    INSERT INTO public.social_alerts (candidate_id, alert_type, severity, title, description, payload)
    SELECT DISTINCT p.candidate_id, 'viral_post'::social_alert_type, 'critical'::social_alert_severity,
           'Crawler pausado automaticamente',
           format('Circuit breaker disparado por %s eventos (login wall/rate limit/captcha) em 10 min', _bad),
           jsonb_build_object('reason','auto_breaker','bad_events',_bad)
    FROM public.social_profiles p
    WHERE p.is_active
    LIMIT 1;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- =========================
-- Dashboard stats
-- =========================
CREATE OR REPLACE FUNCTION public.social_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'jobs', (
      SELECT jsonb_object_agg(status, c) FROM (
        SELECT status::text, COUNT(*) c FROM public.social_jobs GROUP BY status
      ) s
    ),
    'workers_online', (SELECT COUNT(*) FROM public.social_workers WHERE last_seen_at > now() - interval '2 minutes'),
    'workers_total', (SELECT COUNT(*) FROM public.social_workers),
    'workers', (
      SELECT COALESCE(jsonb_agg(row_to_json(w) ORDER BY w.last_seen_at DESC), '[]'::jsonb)
      FROM (
        SELECT worker_id, status, last_seen_at, jobs_processed, last_error,
               (last_seen_at > now() - interval '2 minutes') AS is_online
        FROM public.social_workers
        ORDER BY last_seen_at DESC
        LIMIT 20
      ) w
    ),
    'profiles_active', (SELECT COUNT(*) FROM public.social_profiles WHERE is_active),
    'posts_today', (SELECT COUNT(*) FROM public.social_posts WHERE first_seen_at > date_trunc('day', now())),
    'snapshots_today', (SELECT COUNT(*) FROM public.social_post_snapshots WHERE captured_at > date_trunc('day', now())),
    'last_collection_at', (SELECT MAX(last_success_at) FROM public.social_profiles),
    'recent_errors', (
      SELECT COALESCE(jsonb_agg(row_to_json(l) ORDER BY l.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, created_at, worker_id, level, kind, message
        FROM public.social_worker_logs
        WHERE level IN ('warn','error','critical')
        ORDER BY created_at DESC LIMIT 30
      ) l
    ),
    'breaker', (
      SELECT row_to_json(s) FROM public.social_system_state s WHERE s.id = 1
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- Permissões
REVOKE EXECUTE ON FUNCTION public.claim_next_social_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_social_job(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.social_worker_heartbeat(text,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_worker_heartbeat(text,text,integer,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.social_evaluate_breaker() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_evaluate_breaker() TO service_role;

GRANT EXECUTE ON FUNCTION public.social_dashboard_stats() TO authenticated, service_role;
