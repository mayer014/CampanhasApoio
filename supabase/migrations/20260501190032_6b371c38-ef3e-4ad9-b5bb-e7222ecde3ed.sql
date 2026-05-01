-- Substitui a função: agora apenas marca o template como ativo, sem desativar os outros.
CREATE OR REPLACE FUNCTION public.set_active_template(_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _candidate_id UUID;
BEGIN
  SELECT candidate_id INTO _candidate_id FROM public.templates WHERE id = _template_id;
  IF _candidate_id IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  IF _candidate_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.templates SET is_active = true WHERE id = _template_id;
END;
$function$;

-- Nova função: desativar um template específico
CREATE OR REPLACE FUNCTION public.unset_active_template(_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _candidate_id UUID;
BEGIN
  SELECT candidate_id INTO _candidate_id FROM public.templates WHERE id = _template_id;
  IF _candidate_id IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  IF _candidate_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.templates SET is_active = false WHERE id = _template_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.unset_active_template(UUID) TO authenticated;