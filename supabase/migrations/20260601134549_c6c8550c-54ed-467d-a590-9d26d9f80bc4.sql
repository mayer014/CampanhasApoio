-- Primeiro, limpar a tabela se houver dados de teste
TRUNCATE TABLE public.ai_settings;

-- Adicionar coluna de usuário
ALTER TABLE public.ai_settings ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- Remover índice antigo e criar um novo que permite um ativo POR USUÁRIO
DROP INDEX IF EXISTS idx_active_ai_provider;
CREATE UNIQUE INDEX idx_active_ai_provider_per_user ON public.ai_settings (user_id, is_active) WHERE (is_active = true);

-- Remover políticas antigas
DROP POLICY IF EXISTS "Admins can manage AI settings" ON public.ai_settings;

-- Criar novas políticas flexíveis
CREATE POLICY "Users can manage their own AI settings" 
ON public.ai_settings 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
))
WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
));
