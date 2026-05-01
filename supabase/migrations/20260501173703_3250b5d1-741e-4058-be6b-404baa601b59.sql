CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public._slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(public.unaccent(coalesce(input, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

UPDATE public.candidate_profiles AS cp
SET slug = sub.new_slug
FROM (
  SELECT id,
         CASE
           WHEN public._slugify(slug) = '' THEN substring(id::text, 1, 8)
           ELSE public._slugify(slug)
         END AS new_slug
  FROM public.candidate_profiles
  WHERE slug ~ '[^a-z0-9-]' OR slug ~ '^-' OR slug ~ '-$'
) AS sub
WHERE cp.id = sub.id;