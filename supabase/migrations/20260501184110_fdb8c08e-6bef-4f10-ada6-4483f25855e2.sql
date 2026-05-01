
-- 1) Substitui a policy antiga de UPDATE (que só permitia trocar is_active) por uma completa
DROP POLICY IF EXISTS "Candidates update own templates active flag" ON public.templates;

CREATE POLICY "Candidates update own templates"
ON public.templates
FOR UPDATE
TO authenticated
USING (candidate_id = auth.uid())
WITH CHECK (candidate_id = auth.uid());

-- 2) Permite candidato INSERIR templates (próprios)
CREATE POLICY "Candidates insert own templates"
ON public.templates
FOR INSERT
TO authenticated
WITH CHECK (candidate_id = auth.uid());

-- 3) Permite candidato DELETAR templates (próprios)
CREATE POLICY "Candidates delete own templates"
ON public.templates
FOR DELETE
TO authenticated
USING (candidate_id = auth.uid());

-- 4) Trigger para limitar a 3 templates por candidato (admin não tem limite)
CREATE OR REPLACE FUNCTION public.enforce_candidate_template_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  -- Só aplica o limite quando quem cria é o próprio candidato (não admin)
  IF NEW.candidate_id = auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    SELECT COUNT(*) INTO _count FROM public.templates WHERE candidate_id = NEW.candidate_id;
    IF _count >= 3 THEN
      RAISE EXCEPTION 'Limite de 3 templates atingido. Exclua um template antigo para criar outro.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_candidate_template_limit ON public.templates;
CREATE TRIGGER trg_enforce_candidate_template_limit
BEFORE INSERT ON public.templates
FOR EACH ROW EXECUTE FUNCTION public.enforce_candidate_template_limit();

-- 5) Storage: permite candidato fazer upload em pasta com seu próprio user_id no bucket template-layers
CREATE POLICY "Candidates upload own template layers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'template-layers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Candidates update own template layers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'template-layers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Candidates delete own template layers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'template-layers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
