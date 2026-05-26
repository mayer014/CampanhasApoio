-- Drop crawler functions
DROP FUNCTION IF EXISTS public.social_worker_heartbeat(text, text, integer, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.complete_social_job(uuid, boolean, text) CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_due_social_profiles() CASCADE;
DROP FUNCTION IF EXISTS public.social_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS public.record_social_snapshot(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.claim_next_social_job(text) CASCADE;

-- Drop crawler tables (NOT social_connections / pending_meta_oauth_states — those are the new Meta flow)
DROP TABLE IF EXISTS public.social_post_snapshots CASCADE;
DROP TABLE IF EXISTS public.social_alerts CASCADE;
DROP TABLE IF EXISTS public.social_posts CASCADE;
DROP TABLE IF EXISTS public.social_worker_logs CASCADE;
DROP TABLE IF EXISTS public.social_jobs CASCADE;
DROP TABLE IF EXISTS public.social_workers CASCADE;
DROP TABLE IF EXISTS public.social_profiles CASCADE;
DROP TABLE IF EXISTS public.social_system_state CASCADE;

-- Drop crawler-only enum types
DROP TYPE IF EXISTS public.social_job_type CASCADE;
DROP TYPE IF EXISTS public.social_job_status CASCADE;
DROP TYPE IF EXISTS public.social_log_level CASCADE;
DROP TYPE IF EXISTS public.social_log_kind CASCADE;
DROP TYPE IF EXISTS public.social_profile_type CASCADE;
DROP TYPE IF EXISTS public.social_platform CASCADE;