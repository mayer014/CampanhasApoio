-- Adiciona limite de trial (fotos grátis) por candidato
ALTER TABLE public.candidate_profiles
ADD COLUMN IF NOT EXISTS trial_limit integer NOT NULL DEFAULT 5;

-- Atualiza a função de incremento para também bloquear o candidato
-- automaticamente quando o total de fotos geradas atingir trial_limit.
CREATE OR REPLACE FUNCTION public.increment_template_generation(_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _candidate_id uuid;
  _limit integer;
  _total integer;
BEGIN
  -- Garante que o template está ativo e o candidato não está bloqueado
  SELECT t.candidate_id INTO _candidate_id
  FROM public.templates t
  JOIN public.candidate_profiles cp ON cp.id = t.candidate_id
  WHERE t.id = _template_id
    AND t.is_active = true
    AND cp.is_blocked = false;

  IF _candidate_id IS NULL THEN
    RETURN;
  END IF;

  -- Incrementa o contador do template
  UPDATE public.templates
  SET generation_count = generation_count + 1
  WHERE id = _template_id;

  -- Lê o limite do candidato e o total atual
  SELECT trial_limit INTO _limit
  FROM public.candidate_profiles
  WHERE id = _candidate_id;

  SELECT COALESCE(SUM(generation_count), 0) INTO _total
  FROM public.templates
  WHERE candidate_id = _candidate_id;

  -- Bloqueia automaticamente ao atingir o limite
  IF _limit IS NOT NULL AND _total >= _limit THEN
    UPDATE public.candidate_profiles
    SET is_blocked = true
    WHERE id = _candidate_id;
  END IF;
END;
$function$;