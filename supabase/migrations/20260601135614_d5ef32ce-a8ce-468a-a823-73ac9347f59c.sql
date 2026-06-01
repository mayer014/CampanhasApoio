-- 1. Atualizar social_comments com novos campos
ALTER TABLE public.social_comments 
ADD COLUMN IF NOT EXISTS is_ignored BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sentiment_source TEXT DEFAULT 'ai' CHECK (sentiment_source IN ('ai', 'human')),
ADD COLUMN IF NOT EXISTS sentiment_confidence FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentiment_reason TEXT,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- 2. Tabela sentiment_corrections (alimenta o few-shot)
CREATE TABLE public.sentiment_corrections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    post_message TEXT,
    sentiment_ai public.social_sentiment,
    sentiment_human public.social_sentiment NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabela social_militants (perfil agregado do comentarista)
CREATE TABLE public.social_militants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    author_name TEXT,
    avatar_url TEXT,
    total_comments INTEGER DEFAULT 0,
    total_positive INTEGER DEFAULT 0,
    total_negative INTEGER DEFAULT 0,
    total_neutral INTEGER DEFAULT 0,
    total_30d_positive INTEGER DEFAULT 0,
    total_30d_negative INTEGER DEFAULT 0,
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    promoted_to_supporter_id UUID, -- Destino quando vira apoiador no CRM
    notes TEXT,
    UNIQUE(user_id, platform, platform_user_id)
);

-- 4. Tabela quick_replies (templates de resposta)
CREATE TABLE public.quick_replies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Tabela quick_contacts (contatos rápidos)
CREATE TABLE public.quick_contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_handle TEXT NOT NULL,
    phone TEXT,
    author_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Tabela blocked_users (usuários bloqueados sincronizados)
CREATE TABLE public.blocked_users (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, platform, platform_user_id)
);

-- 7. Tabela comment_actions_log (audit log)
CREATE TABLE public.comment_actions_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.social_comments(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'hide', 'delete', 'block', 'reply'
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Módulo Engajamento
CREATE TABLE public.engagement_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    like_points INTEGER DEFAULT 1,
    comment_points INTEGER DEFAULT 3,
    share_points INTEGER DEFAULT 5,
    reaction_points INTEGER DEFAULT 1,
    inactivity_days INTEGER DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.engagement_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    author_name TEXT,
    avatar_url TEXT,
    score INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, platform, platform_user_id)
);

CREATE TABLE public.engagement_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'like', 'comment', 'share', 'reaction'
    external_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Módulo Missões
CREATE TABLE public.missions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'rejected', 'completed')),
    ai_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.mission_executions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT
);

-- GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ENABLE RLS
ALTER TABLE public.sentiment_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_militants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_executions ENABLE ROW LEVEL SECURITY;

-- POLICIES (Simplificadas por user_id)
CREATE POLICY "Users can manage their own sentiment_corrections" ON public.sentiment_corrections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own social_militants" ON public.social_militants FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own quick_replies" ON public.quick_replies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own quick_contacts" ON public.quick_contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own blocked_users" ON public.blocked_users FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own comment_actions_log" ON public.comment_actions_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own engagement_config" ON public.engagement_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own engagement_scores" ON public.engagement_scores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own engagement_events" ON public.engagement_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own missions" ON public.missions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own mission_executions" ON public.mission_executions FOR ALL USING (auth.uid() = user_id);

-- TRIGGERS E FUNÇÕES

-- 1. Atualizar Perfil de Militância ao mudar sentimento de um comentário
CREATE OR REPLACE FUNCTION public.update_social_militant()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.social_militants (user_id, platform, platform_user_id, author_name, last_seen_at)
    VALUES (NEW.user_id, NEW.platform, NEW.author_id, NEW.author_name, NEW.posted_at)
    ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE
    SET 
        author_name = EXCLUDED.author_name,
        last_seen_at = EXCLUDED.last_seen_at,
        total_comments = (SELECT count(*) FROM public.social_comments WHERE user_id = NEW.user_id AND platform = NEW.platform AND author_id = NEW.author_id),
        total_positive = (SELECT count(*) FROM public.social_comments WHERE user_id = NEW.user_id AND platform = NEW.platform AND author_id = NEW.author_id AND sentiment = 'positive'),
        total_negative = (SELECT count(*) FROM public.social_comments WHERE user_id = NEW.user_id AND platform = NEW.platform AND author_id = NEW.author_id AND sentiment = 'negative'),
        total_neutral = (SELECT count(*) FROM public.social_comments WHERE user_id = NEW.user_id AND platform = NEW.platform AND author_id = NEW.author_id AND sentiment = 'neutral'),
        total_30d_positive = (SELECT count(*) FROM public.social_comments WHERE user_id = NEW.user_id AND platform = NEW.platform AND author_id = NEW.author_id AND sentiment = 'positive' AND posted_at > now() - interval '30 days'),
        total_30d_negative = (SELECT count(*) FROM public.social_comments WHERE user_id = NEW.user_id AND platform = NEW.platform AND author_id = NEW.author_id AND sentiment = 'negative' AND posted_at > now() - interval '30 days');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_social_militant
AFTER INSERT OR UPDATE OF sentiment ON public.social_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_social_militant();

-- 2. Atualizar Engagement Scores ao inserir evento de engajamento
CREATE OR REPLACE FUNCTION public.update_engagement_score()
RETURNS TRIGGER AS $$
DECLARE
    cfg RECORD;
    pts INTEGER := 0;
BEGIN
    SELECT * INTO cfg FROM public.engagement_config WHERE user_id = NEW.user_id;
    IF NOT FOUND THEN
        -- Default config se não existir
        pts := CASE 
            WHEN NEW.event_type = 'like' THEN 1
            WHEN NEW.event_type = 'comment' THEN 3
            WHEN NEW.event_type = 'share' THEN 5
            WHEN NEW.event_type = 'reaction' THEN 1
            ELSE 0
        END;
    ELSE
        pts := CASE 
            WHEN NEW.event_type = 'like' THEN cfg.like_points
            WHEN NEW.event_type = 'comment' THEN cfg.comment_points
            WHEN NEW.event_type = 'share' THEN cfg.share_points
            WHEN NEW.event_type = 'reaction' THEN cfg.reaction_points
            ELSE 0
        END;
    END IF;

    INSERT INTO public.engagement_scores (user_id, platform, platform_user_id, score, last_interaction_at)
    VALUES (NEW.user_id, NEW.platform, NEW.platform_user_id, pts, NEW.created_at)
    ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE
    SET 
        score = engagement_scores.score + pts,
        last_interaction_at = EXCLUDED.last_interaction_at,
        total_likes = engagement_scores.total_likes + (CASE WHEN NEW.event_type = 'like' THEN 1 ELSE 0 END),
        total_comments = engagement_scores.total_comments + (CASE WHEN NEW.event_type = 'comment' THEN 1 ELSE 0 END),
        total_shares = engagement_scores.total_shares + (CASE WHEN NEW.event_type = 'share' THEN 1 ELSE 0 END);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_engagement_score
AFTER INSERT ON public.engagement_events
FOR EACH ROW
EXECUTE FUNCTION public.update_engagement_score();
