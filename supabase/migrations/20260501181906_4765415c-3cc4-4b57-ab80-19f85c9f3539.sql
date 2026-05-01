
-- 1) Deduplicar por (candidate_id, phone normalizado): manter o mais antigo
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY candidate_id, regexp_replace(coalesce(phone,''), '\D', '', 'g')
      ORDER BY created_at ASC
    ) AS rn
  FROM public.voter_leads
  WHERE coalesce(phone,'') <> ''
)
DELETE FROM public.voter_leads vl
USING ranked r
WHERE vl.id = r.id AND r.rn > 1;

-- 2) Índice único por candidato + telefone normalizado
CREATE UNIQUE INDEX IF NOT EXISTS voter_leads_unique_candidate_phone
ON public.voter_leads (
  candidate_id,
  (regexp_replace(coalesce(phone,''), '\D', '', 'g'))
);
