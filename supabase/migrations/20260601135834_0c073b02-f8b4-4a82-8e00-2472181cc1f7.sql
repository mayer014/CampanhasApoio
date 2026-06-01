ALTER TABLE public.social_militants ADD COLUMN IF NOT EXISTS current_badge TEXT DEFAULT 'observador';

CREATE OR REPLACE FUNCTION public.calculate_militant_badge(
    total_comments INTEGER,
    total_pos INTEGER,
    total_neg INTEGER,
    pos_30d INTEGER,
    neg_30d INTEGER,
    last_seen TIMESTAMP WITH TIME ZONE,
    first_seen TIMESTAMP WITH TIME ZONE
) RETURNS TEXT AS $$
BEGIN
    -- 1. Hater Persistente
    IF total_neg >= 10 THEN RETURN 'hater'; END IF;
    
    -- 2. Crítico Recorrente
    IF neg_30d >= 3 THEN RETURN 'critico'; END IF;
    
    -- 3. Tropa de Elite
    IF total_pos >= 15 AND total_neg = 0 THEN RETURN 'tropa_elite'; END IF;
    
    -- 4. Defensor
    IF pos_30d >= 5 THEN RETURN 'defensor'; END IF;
    
    -- 5. Engajado
    IF total_comments >= 10 THEN RETURN 'engajado'; END IF;
    
    -- 6. Novo Rosto
    IF first_seen > now() - interval '7 days' THEN RETURN 'novo'; END IF;
    
    -- 7. Sumido
    IF last_seen < now() - interval '60 days' THEN RETURN 'sumido'; END IF;
    
    -- Default
    RETURN 'observador';
END;
$$ LANGUAGE plpgsql;

-- Atualizar trigger para incluir o badge
CREATE OR REPLACE FUNCTION public.update_social_militant()
RETURNS TRIGGER AS $$
DECLARE
    agg RECORD;
BEGIN
    -- Busca agregados atuais
    SELECT 
        count(*) as total,
        count(*) FILTER (WHERE sentiment = 'positive') as pos,
        count(*) FILTER (WHERE sentiment = 'negative') as neg,
        count(*) FILTER (WHERE sentiment = 'positive' AND posted_at > now() - interval '30 days') as pos30,
        count(*) FILTER (WHERE sentiment = 'negative' AND posted_at > now() - interval '30 days') as neg30
    INTO agg
    FROM public.social_comments 
    WHERE user_id = NEW.user_id AND author_id = NEW.author_id;

    INSERT INTO public.social_militants (user_id, platform, platform_user_id, author_name, last_seen_at, first_seen_at)
    VALUES (NEW.user_id, NEW.platform, NEW.author_id, NEW.author_name, NEW.posted_at, NEW.posted_at)
    ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE
    SET 
        author_name = EXCLUDED.author_name,
        last_seen_at = EXCLUDED.last_seen_at,
        total_comments = agg.total,
        total_positive = agg.pos,
        total_negative = agg.neg,
        total_neutral = agg.total - agg.pos - agg.neg,
        total_30d_positive = agg.pos30,
        total_30d_negative = agg.neg30,
        current_badge = public.calculate_militant_badge(agg.total, agg.pos, agg.neg, agg.pos30, agg.neg30, EXCLUDED.last_seen_at, social_militants.first_seen_at);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
