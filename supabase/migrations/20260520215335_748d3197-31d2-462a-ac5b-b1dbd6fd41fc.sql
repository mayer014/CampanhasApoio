
-- Conceder privilégios de tabela ao papel authenticated (RLS continua aplicando o filtro por candidate_id/admin).
-- Sem esses GRANTs, o Postgres barra a query antes do RLS rodar e o app cai em erro genérico.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_profiles TO authenticated;
GRANT SELECT, UPDATE ON public.social_alerts TO authenticated;
GRANT SELECT ON public.social_posts TO authenticated;
GRANT SELECT ON public.social_post_snapshots TO authenticated;
-- social_jobs: só admin via RLS, mas precisa de GRANT pra policy poder ser avaliada
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_jobs TO authenticated;
GRANT SELECT ON public.social_workers TO authenticated;
GRANT SELECT ON public.social_worker_logs TO authenticated;
GRANT SELECT ON public.social_system_state TO authenticated;

-- service_role bypassa RLS, mas garante privilégios explícitos para todas as tabelas sociais
GRANT ALL ON public.social_profiles TO service_role;
GRANT ALL ON public.social_alerts TO service_role;
GRANT ALL ON public.social_posts TO service_role;
GRANT ALL ON public.social_post_snapshots TO service_role;
GRANT ALL ON public.social_jobs TO service_role;
GRANT ALL ON public.social_workers TO service_role;
GRANT ALL ON public.social_worker_logs TO service_role;
GRANT ALL ON public.social_system_state TO service_role;

-- Sequence usada por social_post_snapshots e social_worker_logs (bigserial)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Garantir EXECUTE de social_dashboard_stats para usuários autenticados (já era PUBLIC, mas explicitamos)
GRANT EXECUTE ON FUNCTION public.social_dashboard_stats() TO authenticated;
