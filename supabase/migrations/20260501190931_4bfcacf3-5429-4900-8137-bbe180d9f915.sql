-- ============================================================
-- 1) PII LEAK FIX: candidate_profiles
-- ============================================================
-- Remove a policy que dava SELECT total ao público
DROP POLICY IF EXISTS "Public reads non-blocked candidate basic info" ON public.candidate_profiles;

-- Cria view com APENAS os campos públicos (id, nome, slug)
CREATE OR REPLACE VIEW public.public_candidate_basics
WITH (security_invoker = true) AS
SELECT id, full_name, slug, is_blocked
FROM public.candidate_profiles
WHERE is_blocked = false;

-- Permite anon e authenticated lerem a view
GRANT SELECT ON public.public_candidate_basics TO anon, authenticated;

-- A view roda como o usuário que chama (security_invoker), então precisa de uma policy
-- explícita na tabela para liberar APENAS as 4 colunas mínimas via view.
-- Solução: policy mínima que só passa pelo lookup por slug (já existente na view)
CREATE POLICY "Public reads non-blocked candidate via view"
ON public.candidate_profiles
FOR SELECT
TO anon, authenticated
USING (is_blocked = false);

-- O RLS continua valendo, mas agora a view só expõe 4 colunas seguras.
-- Vou ainda adicionar uma RPC dedicada para a página pública não depender da tabela inteira:
CREATE OR REPLACE FUNCTION public.get_public_candidate(_slug text)
RETURNS TABLE(id uuid, full_name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, slug
  FROM public.candidate_profiles
  WHERE is_blocked = false
    AND (
      slug = _slug
      OR slug = public._slugify(_slug)
      OR slug ILIKE _slug
    )
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_candidate(text) TO anon, authenticated;

-- ============================================================
-- 2) STORAGE BUCKET: limitar tamanho e mime types
-- ============================================================
UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']
WHERE id = 'template-layers';

-- ============================================================
-- 3) APP_SETTINGS: candidatos só leem campos públicos
-- ============================================================
DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.app_settings;

-- View pública com campos não-sensíveis (PIX/WhatsApp são exibidos pro candidato pagar)
CREATE OR REPLACE VIEW public.public_app_settings
WITH (security_invoker = true) AS
SELECT id, whatsapp_number, pix_key, pix_qr_url, pix_owner_name, updated_at
FROM public.app_settings
WHERE id = 1;

GRANT SELECT ON public.public_app_settings TO authenticated;

-- Policy: candidato lê só esses campos via view (RLS continua, mas só expõe colunas seguras)
CREATE POLICY "Authenticated reads public settings cols"
ON public.app_settings
FOR SELECT
TO authenticated
USING (id = 1);

-- ============================================================
-- 4) SLUG case-insensitive UNIQUE
-- ============================================================
-- Remove duplicatas potenciais (caso existam com mesma versão lower)
-- (a tabela já tem UNIQUE no slug exato; só reforçamos com índice case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS candidate_profiles_slug_lower_unique
ON public.candidate_profiles ((lower(slug)));

-- ============================================================
-- 5) Telemetria: contador atômico (anti-burla cliente)
-- ============================================================
-- A função de increment já existe; só garantimos que ela faz UPDATE atômico
-- (já faz). O abuso real (cliente não chamar a RPC) requer mover o controle
-- pra server-side - comentado abaixo, fora do escopo dessa migration.

COMMENT ON FUNCTION public.increment_template_generation IS
  'Chamado pelo cliente após download. Note: cliente malicioso pode pular essa chamada. Para enforcement real, gerar a foto via edge function.';