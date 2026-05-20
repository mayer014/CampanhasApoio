
-- Anti-spam improvements for WhatsApp campaigns
ALTER TABLE public.whatsapp_broadcasts
  ADD COLUMN IF NOT EXISTS hour_cap integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS allowed_weekdays integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS daytime_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS simulate_typing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS long_pause_every integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS long_pause_seconds_min integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS long_pause_seconds_max integer NOT NULL DEFAULT 900,
  ADD COLUMN IF NOT EXISTS recipient_cooldown_hours integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS append_optout_footer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS shuffle_recipients boolean NOT NULL DEFAULT true;

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS warmup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS warmup_day integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hour_cap integer NOT NULL DEFAULT 60;

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS is_on_whatsapp boolean,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

-- Helper: returns the daily cap for a given warmup day (progressive)
CREATE OR REPLACE FUNCTION public.wa_warmup_cap(_day integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _day <= 1 THEN 20
    WHEN _day = 2 THEN 40
    WHEN _day = 3 THEN 80
    WHEN _day = 4 THEN 120
    WHEN _day = 5 THEN 160
    WHEN _day = 6 THEN 200
    ELSE 300
  END
$$;

-- Index to speed cooldown checks
CREATE INDEX IF NOT EXISTS idx_wa_send_log_candidate_jid_created
  ON public.whatsapp_send_log (candidate_id, jid, created_at DESC);
