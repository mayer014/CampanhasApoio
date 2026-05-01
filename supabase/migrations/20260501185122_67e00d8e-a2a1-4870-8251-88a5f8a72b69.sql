-- Corrige a função de incremento: só aplica limite a clientes em trial (sem unblocked_at)
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
  _unblocked_at timestamptz;
  _signup_source text;
BEGIN
  -- Garante que o template está ativo e o candidato não está bloqueado
  SELECT t.candidate_id, cp.unblocked_at, cp.signup_source, cp.trial_limit
    INTO _candidate_id, _unblocked_at, _signup_source, _limit
  FROM public.templates t
  JOIN public.candidate_profiles cp ON cp.id = t.candidate_id
  WHERE t.id = _template_id
    AND t.is_active = true
    AND cp.is_blocked = false;

  IF _candidate_id IS NULL THEN
    RETURN;
  END IF;

  -- Incrementa o contador do template (sempre, para estatística)
  UPDATE public.templates
  SET generation_count = generation_count + 1
  WHERE id = _template_id;

  -- Se o cliente já foi liberado pelo admin alguma vez (pago), NÃO aplica limite
  IF _unblocked_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- Se não é cadastro público, também não aplica limite (criado pelo admin)
  IF _signup_source <> 'public' THEN
    RETURN;
  END IF;

  -- Cliente em teste: aplica limite
  SELECT COALESCE(SUM(generation_count), 0) INTO _total
  FROM public.templates
  WHERE candidate_id = _candidate_id;

  IF _limit IS NOT NULL AND _total >= _limit THEN
    UPDATE public.candidate_profiles
    SET is_blocked = true
    WHERE id = _candidate_id;
  END IF;
END;
$function$;