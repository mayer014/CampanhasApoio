-- 1. ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'candidate');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. CANDIDATE PROFILES
CREATE TABLE public.candidate_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  slug TEXT NOT NULL UNIQUE,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidate_profiles_slug ON public.candidate_profiles(slug);
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all candidates" ON public.candidate_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Candidates read own profile" ON public.candidate_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Public reads non-blocked candidate basic info" ON public.candidate_profiles
  FOR SELECT TO anon, authenticated
  USING (is_blocked = false);

-- 3. TEMPLATES
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  background_url TEXT,
  base_circle_url TEXT,
  element_url TEXT,
  logo_url TEXT,
  background_transform JSONB NOT NULL DEFAULT '{"x":0,"y":0,"scale":1}'::jsonb,
  base_circle_transform JSONB NOT NULL DEFAULT '{"x":540,"y":540,"scale":1}'::jsonb,
  element_transform JSONB NOT NULL DEFAULT '{"x":540,"y":540,"scale":1}'::jsonb,
  logo_transform JSONB NOT NULL DEFAULT '{"x":540,"y":540,"scale":1}'::jsonb,
  photo_circle JSONB NOT NULL DEFAULT '{"x":540,"y":540,"radius":350}'::jsonb,
  generation_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_candidate ON public.templates(candidate_id);
CREATE INDEX idx_templates_active ON public.templates(candidate_id, is_active) WHERE is_active = true;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all templates" ON public.templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Candidates read own templates" ON public.templates
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

CREATE POLICY "Candidates update own templates active flag" ON public.templates
  FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid())
  WITH CHECK (candidate_id = auth.uid());

CREATE POLICY "Public reads active templates" ON public.templates
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.id = candidate_id AND cp.is_blocked = false
    )
  );

-- 4. VOTER LEADS
CREATE TABLE public.voter_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voter_leads_candidate ON public.voter_leads(candidate_id, created_at DESC);
ALTER TABLE public.voter_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all leads" ON public.voter_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Candidates read own leads" ON public.voter_leads
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

CREATE POLICY "Anyone can insert lead for non-blocked candidate" ON public.voter_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.id = candidate_id AND cp.is_blocked = false
    )
  );

-- 5. PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_candidate ON public.payments(candidate_id, paid_at DESC);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Candidates read own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- 6. SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  due_date DATE,
  monthly_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Candidates read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- 7. RPC: set active template
CREATE OR REPLACE FUNCTION public.set_active_template(_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  UPDATE public.templates SET is_active = false WHERE candidate_id = _candidate_id;
  UPDATE public.templates SET is_active = true WHERE id = _template_id;
END;
$$;

-- 8. RPC: increment generation
CREATE OR REPLACE FUNCTION public.increment_template_generation(_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.templates t
  SET generation_count = generation_count + 1
  WHERE t.id = _template_id
    AND t.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.id = t.candidate_id AND cp.is_blocked = false
    );
END;
$$;

-- 9. updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_candidate_profiles_updated BEFORE UPDATE ON public.candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tg_templates_updated BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10. Restrict grants
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.set_active_template(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_template(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.increment_template_generation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_template_generation(UUID) TO anon, authenticated;

-- 11. STORAGE bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('template-layers', 'template-layers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read individual template layer files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'template-layers' AND name IS NOT NULL);

CREATE POLICY "Admins write template layers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'template-layers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update template layers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'template-layers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete template layers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'template-layers' AND public.has_role(auth.uid(), 'admin'));