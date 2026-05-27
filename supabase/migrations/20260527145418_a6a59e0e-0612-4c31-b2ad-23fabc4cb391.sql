
CREATE TYPE public.social_comment_status AS ENUM ('pending','replied','hidden','handled');

CREATE TABLE public.social_posts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  platform text NOT NULL,
  external_id text NOT NULL,
  caption text,
  thumbnail_url text,
  permalink text,
  media_type text,
  posted_at timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, platform, external_id)
);
CREATE INDEX social_posts_cache_user_idx ON public.social_posts_cache(user_id, posted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts_cache TO authenticated;
GRANT ALL ON public.social_posts_cache TO service_role;
ALTER TABLE public.social_posts_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY spc_owner_all ON public.social_posts_cache FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY spc_admin_all ON public.social_posts_cache FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  platform text NOT NULL,
  post_external_id text NOT NULL,
  comment_external_id text NOT NULL,
  parent_comment_external_id text,
  author_name text,
  author_id text,
  text text,
  posted_at timestamptz,
  status public.social_comment_status NOT NULL DEFAULT 'pending',
  reply_text text,
  replied_at timestamptz,
  replied_external_id text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, platform, comment_external_id)
);
CREATE INDEX social_comments_user_status_idx ON public.social_comments(user_id, status, posted_at DESC);
CREATE INDEX social_comments_post_idx ON public.social_comments(post_external_id);

CREATE TRIGGER social_comments_touch
  BEFORE UPDATE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_comments TO authenticated;
GRANT ALL ON public.social_comments TO service_role;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY sco_owner_all ON public.social_comments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sco_admin_all ON public.social_comments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
