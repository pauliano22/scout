-- Scout Database Migration: Suggested Actions for Smart Links
-- Run this in your Supabase SQL Editor

-- ============================================
-- SUGGESTED ACTIONS TABLE
-- Stores AI-generated action suggestions (calendar events, email drafts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.suggested_actions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Link to related entities (optional)
    alumni_id UUID REFERENCES public.alumni(id) ON DELETE SET NULL,
    coaching_plan_id UUID REFERENCES public.coaching_plans(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,

    -- Action type and status
    action_type TEXT NOT NULL CHECK (action_type IN ('calendar_event', 'email_draft', 'linkedin_message', 'follow_up')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed', 'expired')),

    -- Action payload (flexible JSONB for different action types)
    -- For calendar_event: { title, description, start_time, end_time, location }
    -- For email_draft: { recipient_email, recipient_name, subject, body }
    -- For linkedin_message: { recipient_name, profile_url, message }
    -- For follow_up: { type, target_date, notes }
    payload JSONB NOT NULL,

    -- AI context
    ai_reasoning TEXT, -- Why the AI suggested this action
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00

    -- Timestamps
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration for time-sensitive actions
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suggested_actions_user ON public.suggested_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_alumni ON public.suggested_actions(alumni_id);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_plan ON public.suggested_actions(coaching_plan_id);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_status ON public.suggested_actions(status);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_type ON public.suggested_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_created ON public.suggested_actions(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.suggested_actions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own suggested actions
CREATE POLICY "Users can view own suggested actions" ON public.suggested_actions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suggested actions" ON public.suggested_actions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suggested actions" ON public.suggested_actions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suggested actions" ON public.suggested_actions
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER FOR updated_at
-- ============================================
CREATE TRIGGER update_suggested_actions_updated_at
    BEFORE UPDATE ON public.suggested_actions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- HELPER FUNCTION: Mark action as completed
-- ============================================
CREATE OR REPLACE FUNCTION mark_action_completed(p_action_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.suggested_actions
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_action_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Get pending actions for user
-- ============================================
CREATE OR REPLACE FUNCTION get_pending_actions(p_limit INTEGER DEFAULT 10)
RETURNS SETOF public.suggested_actions AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.suggested_actions
    WHERE user_id = auth.uid()
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY
        CASE action_type
            WHEN 'calendar_event' THEN 1
            WHEN 'email_draft' THEN 2
            ELSE 3
        END,
        created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
