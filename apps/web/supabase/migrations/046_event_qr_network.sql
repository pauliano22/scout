-- Migration 035: Event QR Connection Network
-- Creates tables for event-based temporary group chats with QR codes

-- Event chat sessions: one per sport event
CREATE TABLE IF NOT EXISTS event_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  sport TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Participants who joined the temporary chat
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES event_chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_name TEXT
);

-- Messages in the temporary event chat
CREATE TABLE IF NOT EXISTS event_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES event_chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_participants_session
  ON event_participants (session_id);

CREATE INDEX IF NOT EXISTS idx_event_participants_user
  ON event_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_event_chat_messages_session
  ON event_chat_messages (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_event_chat_sessions_code
  ON event_chat_sessions (code);

-- Enable RLS
ALTER TABLE event_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for event_chat_sessions
-- Anyone can view active sessions (for the landing page)
CREATE POLICY "Anyone can view active sessions"
  ON event_chat_sessions
  FOR SELECT
  USING (is_active = true);

-- Only authenticated users can create sessions
CREATE POLICY "Authenticated users can create sessions"
  ON event_chat_sessions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Session creator / admins can update
CREATE POLICY "Admins can update sessions"
  ON event_chat_sessions
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE is_admin = true
    )
  );

-- RLS policies for event_participants
-- Participants can see who else is in the session
CREATE POLICY "Participants can view other participants"
  ON event_participants
  FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM event_participants WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can join (insert themselves)
CREATE POLICY "Users can join sessions"
  ON event_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM event_chat_sessions
      WHERE id = session_id AND is_active = true
    )
  );

-- RLS policies for event_chat_messages
-- Participants can read messages
CREATE POLICY "Participants can read messages"
  ON event_chat_messages
  FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM event_participants WHERE user_id = auth.uid()
    )
  );

-- Authenticated users in the session can send messages
CREATE POLICY "Participants can send messages"
  ON event_chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.role() = 'authenticated'
    AND session_id IN (
      SELECT session_id FROM event_participants WHERE user_id = auth.uid()
    )
  );
