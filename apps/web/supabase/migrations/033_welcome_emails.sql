-- Migration 033: Welcome Emails
-- Tracks which welcome-email days have been sent to each user
-- to avoid double-sending when the cron fires.

CREATE TABLE IF NOT EXISTS public.welcome_emails (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_day  INTEGER NOT NULL CHECK (email_day IN (1, 2, 4, 7)),
    sent_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (user_id, email_day)
);

-- Index for the cron query: find users who haven't received a given day's email
CREATE INDEX IF NOT EXISTS idx_welcome_emails_user_day
    ON public.welcome_emails (user_id, email_day);

COMMENT ON TABLE public.welcome_emails IS 'Tracks which welcome-sequence emails have been sent to which users';
COMMENT ON COLUMN public.welcome_emails.email_day IS 'Day in the sequence (1 = welcome, 2 = suggestions, 4 = tips, 7 = success stories)';
COMMENT ON COLUMN public.welcome_emails.sent_at IS 'When the email was actually dispatched';
