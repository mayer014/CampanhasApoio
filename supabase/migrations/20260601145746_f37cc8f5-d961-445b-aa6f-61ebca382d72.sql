-- 1. Remove duplicate posts keeping the newest one
DELETE FROM public.social_posts_cache a
USING public.social_posts_cache b
WHERE a.id < b.id 
  AND a.external_id = b.external_id;

-- 2. Add the unique constraint
ALTER TABLE public.social_posts_cache ADD CONSTRAINT social_posts_cache_external_id_unique UNIQUE (external_id);

-- 3. Add the foreign key
ALTER TABLE public.social_comments 
ADD CONSTRAINT fk_social_comments_post_cache 
FOREIGN KEY (post_external_id) 
REFERENCES public.social_posts_cache(external_id)
ON DELETE CASCADE;

-- 4. Fix militants unique constraint
ALTER TABLE public.social_militants DROP CONSTRAINT IF EXISTS social_militants_user_id_platform_platform_user_id_key;
-- If it already exists with a different name or was partially applied:
ALTER TABLE public.social_militants DROP CONSTRAINT IF EXISTS social_militants_unique_identity;
ALTER TABLE public.social_militants ADD CONSTRAINT social_militants_unique_identity UNIQUE (user_id, platform, platform_user_id);
