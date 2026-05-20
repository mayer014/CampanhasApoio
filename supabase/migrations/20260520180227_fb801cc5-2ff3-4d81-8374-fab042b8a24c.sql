
REVOKE EXECUTE ON FUNCTION public.claim_next_social_job(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_social_job(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_due_social_profiles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_social_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_social_job(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_due_social_profiles() TO service_role;
