
DO $$
BEGIN
  PERFORM cron.unschedule('whatsapp-broadcast-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'whatsapp-broadcast-tick',
  '30 seconds',
  $$ SELECT net.http_post(
       url:='https://project--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app/api/public/whatsapp/broadcast-tick',
       headers:='{"Content-Type": "application/json"}'::jsonb,
       body:='{}'::jsonb
     ) AS request_id;
  $$
);

-- Storage bucket for broadcast media (public so motor can fetch)
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "wa_media_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media');

CREATE POLICY "wa_media_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "wa_media_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "wa_media_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));
