-- Garantir que a função de atualização de timestamp exista
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela de configurações de IA
CREATE TABLE public.ai_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('lovable', 'openrouter', 'openai', 'anthropic', 'groq')),
    model_name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Garantir que apenas uma configuração esteja ativa por vez
CREATE UNIQUE INDEX idx_active_ai_provider ON public.ai_settings (is_active) WHERE (is_active = true);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;

-- Habilitar RLS
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Políticas: Apenas admins podem gerenciar chaves de IA
CREATE POLICY "Admins can manage AI settings" 
ON public.ai_settings 
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_ai_settings_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
