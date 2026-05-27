
CREATE TYPE public.social_sentiment AS ENUM ('positive', 'neutral', 'negative');

ALTER TABLE public.social_comments
  ADD COLUMN sentiment public.social_sentiment,
  ADD COLUMN emotion text,
  ADD COLUMN topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN ai_processed_at timestamptz;

CREATE INDEX idx_social_comments_sentiment ON public.social_comments(user_id, sentiment);
CREATE INDEX idx_social_comments_ai_pending ON public.social_comments(user_id) WHERE ai_processed_at IS NULL;
