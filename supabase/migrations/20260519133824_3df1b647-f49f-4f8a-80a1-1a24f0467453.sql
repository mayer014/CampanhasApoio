
-- ============ WHATSAPP MODULE ============

-- Enums
CREATE TYPE public.whatsapp_instance_status AS ENUM ('connecting', 'connected', 'disconnected');
CREATE TYPE public.whatsapp_broadcast_status AS ENUM ('draft', 'running', 'paused', 'completed', 'failed');
CREATE TYPE public.whatsapp_recipient_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
CREATE TYPE public.whatsapp_target_type AS ENUM ('contacts', 'groups', 'leads', 'manual_list', 'mixed');

-- ============ TABLES ============

CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL UNIQUE,
  instance_id text,
  name text NOT NULL,
  phone_number text,
  status public.whatsapp_instance_status NOT NULL DEFAULT 'connecting',
  api_key text,
  webhook_registered boolean NOT NULL DEFAULT false,
  last_qr text,
  last_connected_at timestamptz,
  daily_cap integer NOT NULL DEFAULT 200,
  quiet_hours_start integer NOT NULL DEFAULT 22,
  quiet_hours_end integer NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  jid text NOT NULL,
  name text,
  push_name text,
  phone text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, jid)
);
CREATE INDEX idx_wa_contacts_candidate ON public.whatsapp_contacts(candidate_id);

CREATE TABLE public.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  jid text NOT NULL,
  name text,
  participants_count integer,
  is_favorite boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, jid)
);
CREATE INDEX idx_wa_groups_candidate ON public.whatsapp_groups(candidate_id);
CREATE INDEX idx_wa_groups_fav ON public.whatsapp_groups(candidate_id, is_favorite);

CREATE TABLE public.whatsapp_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  jid text NOT NULL,
  name text,
  is_group boolean NOT NULL DEFAULT false,
  unread_count integer NOT NULL DEFAULT 0,
  last_message_text text,
  last_message_at timestamptz,
  last_message_from_me boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, jid)
);
CREATE INDEX idx_wa_chats_candidate_last ON public.whatsapp_chats(candidate_id, last_message_at DESC NULLS LAST);

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  message_id text NOT NULL,
  jid text NOT NULL,
  from_me boolean NOT NULL DEFAULT false,
  push_name text,
  message_type text NOT NULL DEFAULT 'text',
  text text,
  media_url text,
  media_mime text,
  media_filename text,
  media_size bigint,
  ts timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, message_id)
);
CREATE INDEX idx_wa_messages_chat ON public.whatsapp_messages(candidate_id, jid, ts DESC);

CREATE TABLE public.whatsapp_optouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  jid text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, jid)
);

CREATE TABLE public.whatsapp_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  name text NOT NULL,
  message_text text NOT NULL,
  media_url text,
  target_type public.whatsapp_target_type NOT NULL DEFAULT 'manual_list',
  status public.whatsapp_broadcast_status NOT NULL DEFAULT 'draft',
  interval_min_seconds integer NOT NULL DEFAULT 30,
  interval_max_seconds integer NOT NULL DEFAULT 90,
  daily_cap integer NOT NULL DEFAULT 200,
  respect_quiet_hours boolean NOT NULL DEFAULT true,
  total integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  next_send_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_bcast_candidate ON public.whatsapp_broadcasts(candidate_id, created_at DESC);
CREATE INDEX idx_wa_bcast_running ON public.whatsapp_broadcasts(status) WHERE status = 'running';

CREATE TABLE public.whatsapp_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.whatsapp_broadcasts(id) ON DELETE CASCADE,
  jid text NOT NULL,
  display_name text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.whatsapp_recipient_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_bcast_rcpt_status ON public.whatsapp_broadcast_recipients(broadcast_id, status);

CREATE TABLE public.whatsapp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  jid text NOT NULL,
  broadcast_id uuid,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_sendlog_cand_time ON public.whatsapp_send_log(candidate_id, created_at DESC);

-- ============ TRIGGERS ============

CREATE TRIGGER trg_wa_instances_updated BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wa_bcast_updated BEFORE UPDATE ON public.whatsapp_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS ============

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_optouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

-- Helper: candidate-owned tables (admin + owner)
-- whatsapp_instances: do NOT expose api_key to client; we never SELECT api_key from browser code anyway.
-- Owner policies (admin uses ALL via has_role).

-- instances
CREATE POLICY "wa_inst_admin_all" ON public.whatsapp_instances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_inst_owner_select" ON public.whatsapp_instances FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());
CREATE POLICY "wa_inst_owner_update" ON public.whatsapp_instances FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid()) WITH CHECK (candidate_id = auth.uid());

-- contacts
CREATE POLICY "wa_cont_admin_all" ON public.whatsapp_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_cont_owner_select" ON public.whatsapp_contacts FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- groups
CREATE POLICY "wa_grp_admin_all" ON public.whatsapp_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_grp_owner_select" ON public.whatsapp_groups FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());
CREATE POLICY "wa_grp_owner_update" ON public.whatsapp_groups FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid()) WITH CHECK (candidate_id = auth.uid());

-- chats
CREATE POLICY "wa_chat_admin_all" ON public.whatsapp_chats FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_chat_owner_select" ON public.whatsapp_chats FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());
CREATE POLICY "wa_chat_owner_update" ON public.whatsapp_chats FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid()) WITH CHECK (candidate_id = auth.uid());

-- messages
CREATE POLICY "wa_msg_admin_all" ON public.whatsapp_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_msg_owner_select" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- optouts
CREATE POLICY "wa_opt_admin_all" ON public.whatsapp_optouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_opt_owner_select" ON public.whatsapp_optouts FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());
CREATE POLICY "wa_opt_owner_insert" ON public.whatsapp_optouts FOR INSERT TO authenticated
  WITH CHECK (candidate_id = auth.uid());
CREATE POLICY "wa_opt_owner_delete" ON public.whatsapp_optouts FOR DELETE TO authenticated
  USING (candidate_id = auth.uid());

-- broadcasts
CREATE POLICY "wa_bc_admin_all" ON public.whatsapp_broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_bc_owner_select" ON public.whatsapp_broadcasts FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());
CREATE POLICY "wa_bc_owner_insert" ON public.whatsapp_broadcasts FOR INSERT TO authenticated
  WITH CHECK (candidate_id = auth.uid());
CREATE POLICY "wa_bc_owner_update" ON public.whatsapp_broadcasts FOR UPDATE TO authenticated
  USING (candidate_id = auth.uid()) WITH CHECK (candidate_id = auth.uid());
CREATE POLICY "wa_bc_owner_delete" ON public.whatsapp_broadcasts FOR DELETE TO authenticated
  USING (candidate_id = auth.uid());

-- broadcast_recipients (joined via broadcast)
CREATE POLICY "wa_bcr_admin_all" ON public.whatsapp_broadcast_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_bcr_owner_select" ON public.whatsapp_broadcast_recipients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_broadcasts b WHERE b.id = broadcast_id AND b.candidate_id = auth.uid()));

-- send_log: read-only for owner
CREATE POLICY "wa_sl_admin_all" ON public.whatsapp_send_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_sl_owner_select" ON public.whatsapp_send_log FOR SELECT TO authenticated
  USING (candidate_id = auth.uid());

-- ============ EXTENSIONS for cron ============
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
