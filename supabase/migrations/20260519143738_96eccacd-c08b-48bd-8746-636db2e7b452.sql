
CREATE POLICY "wa_chat_owner_insert" ON public.whatsapp_chats
  FOR INSERT TO authenticated WITH CHECK (candidate_id = auth.uid());

CREATE POLICY "wa_grp_owner_insert" ON public.whatsapp_groups
  FOR INSERT TO authenticated WITH CHECK (candidate_id = auth.uid());

CREATE POLICY "wa_cont_owner_insert" ON public.whatsapp_contacts
  FOR INSERT TO authenticated WITH CHECK (candidate_id = auth.uid());

CREATE POLICY "wa_msg_owner_insert" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (candidate_id = auth.uid());

CREATE POLICY "wa_sl_owner_insert" ON public.whatsapp_send_log
  FOR INSERT TO authenticated WITH CHECK (candidate_id = auth.uid());

CREATE POLICY "wa_bcr_owner_insert" ON public.whatsapp_broadcast_recipients
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_broadcasts b
      WHERE b.id = whatsapp_broadcast_recipients.broadcast_id
        AND b.candidate_id = auth.uid()
    )
  );
