-- IDEA 23: Team-Specific Alumni News Digest
-- Creates tables for digest preferences and queue storage

CREATE TABLE IF NOT EXISTS public.digest_settings (
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  subscribed_sports text[] NOT NULL DEFAULT '{}',
  digest_frequency  text NOT NULL DEFAULT 'weekly' CHECK (digest_frequency IN ('weekly', 'monthly', 'never')),
  last_sent_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.digest_queue (
  id            uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sport         text NOT NULL,
  entries       jsonb NOT NULL DEFAULT '[]',
  frequency     text NOT NULL,
  sent_at       timestamptz,
  generated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_settings_sports 
  ON public.digest_settings USING GIN (subscribed_sports);
CREATE INDEX IF NOT EXISTS idx_digest_queue_unsent 
  ON public.digest_queue (sent_at) WHERE sent_at IS NULL;

ALTER TABLE public.digest_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own digest settings"
  ON public.digest_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own digest settings"
  ON public.digest_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own digest settings"
  ON public.digest_settings FOR UPDATE
  USING (auth.uid() = user_id);
