-- 1. Create portal_missions table
CREATE TABLE public.portal_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'ambos')),
  post_url text NOT NULL,
  title text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create whatsapp_dispatches table
CREATE TABLE public.whatsapp_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  title text,
  message text NOT NULL,
  media_url text,
  type text NOT NULL CHECK (type IN ('tags', 'todos', 'grupos', 'eleicao')),
  filters jsonb DEFAULT '{}'::jsonb, -- tag_filtro, eleicao_tipo, eleicao_escopo, eleicao_regiao, group_jids
  batch_size int NOT NULL DEFAULT 20,
  delay_min int NOT NULL DEFAULT 5,
  delay_max int NOT NULL DEFAULT 15,
  batch_pause int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enfileirado', 'enviando', 'pausado_timeout', 'pausado_janela', 'pausado_sem_instancia', 'concluido', 'cancelado', 'erro')),
  total_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  pause_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create whatsapp_dispatch_items table
CREATE TABLE public.whatsapp_dispatch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.whatsapp_dispatches(id) ON DELETE CASCADE,
  contact_name text,
  contact_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'falha', 'cancelado')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS and set grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_missions TO authenticated;
GRANT ALL ON public.portal_missions TO service_role;
ALTER TABLE public.portal_missions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_dispatches TO authenticated;
GRANT ALL ON public.whatsapp_dispatches TO service_role;
ALTER TABLE public.whatsapp_dispatches ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_dispatch_items TO authenticated;
GRANT ALL ON public.whatsapp_dispatch_items TO service_role;
ALTER TABLE public.whatsapp_dispatch_items ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Portal Missions
CREATE POLICY "Owner manages missions" ON public.portal_missions FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Authenticated read active" ON public.portal_missions FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- WhatsApp Dispatches
CREATE POLICY "Owner manages dispatches" ON public.whatsapp_dispatches FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- WhatsApp Dispatch Items
CREATE POLICY "Owner manages dispatch items" ON public.whatsapp_dispatch_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.whatsapp_dispatches d WHERE d.id = dispatch_id AND d.client_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_dispatches d WHERE d.id = dispatch_id AND d.client_id = auth.uid()));

-- 6. Indexes
CREATE INDEX idx_portal_missions_client_active ON public.portal_missions(client_id, is_active, display_order);
CREATE INDEX idx_whatsapp_dispatches_client_status ON public.whatsapp_dispatches(client_id, status);
CREATE INDEX idx_whatsapp_dispatch_items_dispatch_status ON public.whatsapp_dispatch_items(dispatch_id, status);

-- 7. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_portal_missions_updated_at BEFORE UPDATE ON public.portal_missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whatsapp_dispatches_updated_at BEFORE UPDATE ON public.whatsapp_dispatches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Storage Bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'whatsapp-media');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Update and Delete" ON storage.objects FOR ALL USING (bucket_id = 'whatsapp-media' AND (storage.foldername(name))[1] = auth.uid()::text);
