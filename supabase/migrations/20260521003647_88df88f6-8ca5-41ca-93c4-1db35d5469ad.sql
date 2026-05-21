
-- 1) Enum profile_type
DO $$ BEGIN
  CREATE TYPE public.social_profile_type AS ENUM ('own_profile','competitor','portal','influencer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Coluna profile_type em social_profiles
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS profile_type public.social_profile_type NOT NULL DEFAULT 'competitor';

UPDATE public.social_profiles
  SET profile_type = CASE WHEN is_own THEN 'own_profile'::public.social_profile_type
                          ELSE 'competitor'::public.social_profile_type END
  WHERE profile_type IS NULL OR (is_own AND profile_type <> 'own_profile');

-- Unique (candidate, platform, lower(username))
CREATE UNIQUE INDEX IF NOT EXISTS social_profiles_candidate_platform_username_uidx
  ON public.social_profiles (candidate_id, platform, lower(username));

-- 3) Unique (profile_id, external_id) em social_posts (idempotência)
CREATE UNIQUE INDEX IF NOT EXISTS social_posts_profile_external_uidx
  ON public.social_posts (profile_id, external_id);

-- 4) Tabela social_post_snapshots
CREATE TABLE IF NOT EXISTS public.social_post_snapshots (
  id            bigserial PRIMARY KEY,
  post_id       uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  likes         integer,
  comments      integer,
  views         integer
);
CREATE INDEX IF NOT EXISTS social_post_snapshots_post_idx
  ON public.social_post_snapshots (post_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS social_post_snapshots_candidate_idx
  ON public.social_post_snapshots (candidate_id, captured_at DESC);

ALTER TABLE public.social_post_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sps_admin_all ON public.social_post_snapshots;
CREATE POLICY sps_admin_all ON public.social_post_snapshots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS sps_owner_select ON public.social_post_snapshots;
CREATE POLICY sps_owner_select ON public.social_post_snapshots
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- 5) Tabela social_alerts
CREATE TABLE IF NOT EXISTS public.social_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     uuid NOT NULL,
  profile_id       uuid,
  post_id          uuid,
  alert_type       text NOT NULL CHECK (alert_type IN ('viral_post','competitor_growth')),
  severity         text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  title            text NOT NULL,
  message          text,
  data             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  acknowledged_at  timestamptz,
  acknowledged_by  uuid
);
CREATE INDEX IF NOT EXISTS social_alerts_candidate_idx
  ON public.social_alerts (candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS social_alerts_type_idx
  ON public.social_alerts (alert_type, created_at DESC);

ALTER TABLE public.social_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_admin_all ON public.social_alerts;
CREATE POLICY sa_admin_all ON public.social_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS sa_owner_select ON public.social_alerts;
CREATE POLICY sa_owner_select ON public.social_alerts
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

DROP POLICY IF EXISTS sa_owner_update ON public.social_alerts;
CREATE POLICY sa_owner_update ON public.social_alerts
  FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid())
  WITH CHECK (candidate_id = auth.uid());

-- 6) Função record_social_snapshot — grava snapshot e dispara alertas heurísticos
CREATE OR REPLACE FUNCTION public.record_social_snapshot(_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _post   public.social_posts%ROWTYPE;
  _prof   public.social_profiles%ROWTYPE;
  _avg    numeric;
  _exists boolean;
  _last_followers integer;
  _prev_followers integer;
  _delta_pct numeric;
BEGIN
  SELECT * INTO _post FROM public.social_posts WHERE id = _post_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO _prof FROM public.social_profiles WHERE id = _post.profile_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- snapshot
  INSERT INTO public.social_post_snapshots (post_id, candidate_id, likes, comments, views)
  VALUES (_post.id, _post.candidate_id, _post.likes, _post.comments, _post.views);

  -- VIRAL POST: post de own_profile / competitor com likes ≥ 3× a média dos últimos 7 snapshots
  -- coletados em uma janela < 6h e que tenha ao menos 3 snapshots prévios.
  IF _prof.profile_type IN ('own_profile','competitor') AND COALESCE(_post.likes,0) > 50 THEN
    SELECT AVG(s.likes)::numeric INTO _avg
      FROM (SELECT likes FROM public.social_post_snapshots
              WHERE post_id = _post.id AND captured_at > now() - interval '6 hours'
              ORDER BY captured_at DESC OFFSET 1 LIMIT 7) s;

    IF _avg IS NOT NULL AND _avg > 0 AND _post.likes >= _avg * 3 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.social_alerts
         WHERE post_id = _post.id AND alert_type = 'viral_post'
           AND created_at > now() - interval '24 hours'
      ) INTO _exists;
      IF NOT _exists THEN
        INSERT INTO public.social_alerts (candidate_id, profile_id, post_id, alert_type, severity, title, message, data)
        VALUES (_post.candidate_id, _post.profile_id, _post.id, 'viral_post', 'warn',
                'Post viralizando em @' || _prof.username,
                'Curtidas saltaram para ' || _post.likes || ' (média recente ~' || round(_avg) || ').',
                jsonb_build_object('likes', _post.likes, 'avg', _avg, 'post_url', _post.post_url));
      END IF;
    END IF;
  END IF;

  -- COMPETITOR GROWTH: seguidores crescem ≥ 10% em 7 dias
  IF _prof.profile_type = 'competitor' AND _prof.followers_count IS NOT NULL THEN
    _last_followers := _prof.followers_count;
    SELECT (data->>'followers')::int INTO _prev_followers
      FROM public.social_alerts
      WHERE profile_id = _prof.id AND alert_type = 'competitor_growth'
      ORDER BY created_at DESC LIMIT 1;

    IF _prev_followers IS NULL THEN
      -- baseline: cria registro de referência silencioso
      INSERT INTO public.social_alerts (candidate_id, profile_id, alert_type, severity, title, message, data)
      VALUES (_prof.candidate_id, _prof.id, 'competitor_growth', 'info',
              'Baseline de seguidores de @' || _prof.username,
              'Referência inicial para detecção de crescimento.',
              jsonb_build_object('followers', _last_followers, 'baseline', true));
    ELSE
      _delta_pct := ((_last_followers - _prev_followers)::numeric / NULLIF(_prev_followers,0)) * 100;
      IF _delta_pct >= 10 THEN
        INSERT INTO public.social_alerts (candidate_id, profile_id, alert_type, severity, title, message, data)
        VALUES (_prof.candidate_id, _prof.id, 'competitor_growth', 'warn',
                'Concorrente @' || _prof.username || ' crescendo',
                'Ganhou ' || round(_delta_pct,1) || '% de seguidores desde a última leitura.',
                jsonb_build_object('followers', _last_followers, 'previous', _prev_followers, 'delta_pct', _delta_pct));
      END IF;
    END IF;
  END IF;
END;
$fn$;
