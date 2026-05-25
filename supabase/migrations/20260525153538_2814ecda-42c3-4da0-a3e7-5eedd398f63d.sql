
CREATE OR REPLACE FUNCTION public.claim_next_social_job(_worker_id text)
 RETURNS TABLE(id uuid, job_type social_job_type, candidate_id uuid, profile_id uuid, payload jsonb, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _job_id uuid;
  _state public.social_system_state%ROWTYPE;
BEGIN
  SELECT * INTO _state FROM public.social_system_state WHERE social_system_state.id = 1;
  IF _state.breaker_open AND _state.breaker_reset_at IS NOT NULL AND _state.breaker_reset_at <= now() THEN
    UPDATE public.social_system_state
      SET breaker_open = false, breaker_reason = NULL, breaker_reset_at = NULL, updated_at = now()
      WHERE social_system_state.id = 1;
    _state.breaker_open := false;
  END IF;
  IF _state.breaker_open THEN RETURN; END IF;

  SELECT j.id INTO _job_id FROM public.social_jobs j
    WHERE j.status = 'pending' AND j.scheduled_at <= now()
    ORDER BY j.priority ASC, j.scheduled_at ASC
    LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF _job_id IS NULL THEN RETURN; END IF;

  UPDATE public.social_jobs AS sj
    SET status = 'running',
        started_at = now(),
        worker_id = _worker_id,
        attempts = sj.attempts + 1
    WHERE sj.id = _job_id;

  RETURN QUERY
    SELECT j.id, j.job_type, j.candidate_id, j.profile_id, j.payload, j.attempts
    FROM public.social_jobs j
    WHERE j.id = _job_id;
END;
$function$;
