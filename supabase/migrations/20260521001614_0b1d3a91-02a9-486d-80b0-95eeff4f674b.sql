-- DESTRUCTIVE: drop all social intelligence schema
DROP FUNCTION IF EXISTS public.social_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS public.social_evaluate_breaker() CASCADE;
DROP FUNCTION IF EXISTS public.social_worker_heartbeat(text, text, integer, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.claim_next_social_job(text) CASCADE;
DROP FUNCTION IF EXISTS public.complete_social_job(uuid, boolean, text) CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_due_social_profiles() CASCADE;

DROP TABLE IF EXISTS public.social_alerts CASCADE;
DROP TABLE IF EXISTS public.social_post_snapshots CASCADE;
DROP TABLE IF EXISTS public.social_posts CASCADE;
DROP TABLE IF EXISTS public.social_jobs CASCADE;
DROP TABLE IF EXISTS public.social_worker_logs CASCADE;
DROP TABLE IF EXISTS public.social_workers CASCADE;
DROP TABLE IF EXISTS public.social_profiles CASCADE;
DROP TABLE IF EXISTS public.social_system_state CASCADE;

DROP TYPE IF EXISTS public.social_alert_severity CASCADE;
DROP TYPE IF EXISTS public.social_alert_type CASCADE;
DROP TYPE IF EXISTS public.social_log_kind CASCADE;
DROP TYPE IF EXISTS public.social_log_level CASCADE;
DROP TYPE IF EXISTS public.social_post_type CASCADE;
DROP TYPE IF EXISTS public.social_platform CASCADE;
DROP TYPE IF EXISTS public.social_profile_type CASCADE;
DROP TYPE IF EXISTS public.social_job_status CASCADE;
DROP TYPE IF EXISTS public.social_job_type CASCADE;