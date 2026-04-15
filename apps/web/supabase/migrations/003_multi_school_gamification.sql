-- Scout Database Migration: Multi-School Support & Gamification
-- Run this AFTER the initial schema migration

-- ============================================
-- SCHOOLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE, -- 'cornell', 'harvard', etc.
    display_name TEXT NOT NULL, -- 'Cornell University'
    primary_color TEXT NOT NULL, -- '#B31B1B'
    secondary_color TEXT NOT NULL, -- '#e63946'
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ADD SCHOOL REFERENCE TO ALUMNI
-- ============================================
ALTER TABLE public.alumni 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);

-- ============================================
-- ADD SCHOOL REFERENCE TO PROFILES
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);

-- ============================================
-- USER STREAKS & GAMIFICATION
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    
    -- Streak tracking
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    
    -- XP & Leveling
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    
    -- Activity counts
    total_connections INTEGER DEFAULT 0,
    total_messages_sent INTEGER DEFAULT 0,
    total_responses_received INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ACHIEVEMENTS/BADGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL, -- emoji or icon name
    xp_reward INTEGER DEFAULT 0,
    requirement_type TEXT NOT NULL, -- 'streak', 'connections', 'messages', 'responses'
    requirement_value INTEGER NOT NULL,
    tier TEXT DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- USER ACHIEVEMENTS (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- ============================================
-- DAILY GOALS
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_goals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    connections_goal INTEGER DEFAULT 3,
    connections_made INTEGER DEFAULT 0,
    messages_goal INTEGER DEFAULT 2,
    messages_sent INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_alumni_school ON public.alumni(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date ON public.daily_goals(user_id, date);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;

-- Schools are public read
CREATE POLICY "Anyone can view schools" ON public.schools
    FOR SELECT USING (true);

-- User stats - users can only see their own
CREATE POLICY "Users can view own stats" ON public.user_stats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON public.user_stats
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats" ON public.user_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements are public read
CREATE POLICY "Anyone can view achievements" ON public.achievements
    FOR SELECT USING (true);

-- User achievements
CREATE POLICY "Users can view own achievements" ON public.user_achievements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON public.user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily goals
CREATE POLICY "Users can view own goals" ON public.daily_goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own goals" ON public.daily_goals
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SEED SCHOOLS DATA
-- ============================================
INSERT INTO public.schools (name, slug, display_name, primary_color, secondary_color) VALUES
('cornell', 'cornell', 'Cornell University', '#B31B1B', '#e63946'),
('harvard', 'harvard', 'Harvard University', '#A51C30', '#c9102f'),
('yale', 'yale', 'Yale University', '#00356B', '#286dc0'),
('princeton', 'princeton', 'Princeton University', '#E77500', '#ff8f00'),
('penn', 'penn', 'University of Pennsylvania', '#011F5B', '#82afdb'),
('columbia', 'columbia', 'Columbia University', '#1d4f91', '#B9D9EB'),
('brown', 'brown', 'Brown University', '#4E3629', '#7c5b4a'),
('dartmouth', 'dartmouth', 'Dartmouth College', '#00693E', '#12a150')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- SEED ACHIEVEMENTS DATA
-- ============================================
INSERT INTO public.achievements (slug, name, description, icon, xp_reward, requirement_type, requirement_value, tier) VALUES
-- Streak achievements
('streak_3', 'Getting Started', 'Maintain a 3-day streak', '🔥', 50, 'streak', 3, 'bronze'),
('streak_7', 'Week Warrior', 'Maintain a 7-day streak', '⚡', 150, 'streak', 7, 'silver'),
('streak_14', 'Two Week Champion', 'Maintain a 14-day streak', '💪', 300, 'streak', 14, 'gold'),
('streak_30', 'Monthly Master', 'Maintain a 30-day streak', '👑', 750, 'streak', 30, 'platinum'),

-- Connection achievements
('connections_5', 'First Network', 'Add 5 people to your network', '🤝', 25, 'connections', 5, 'bronze'),
('connections_25', 'Growing Network', 'Add 25 people to your network', '🌱', 100, 'connections', 25, 'silver'),
('connections_50', 'Network Builder', 'Add 50 people to your network', '🏗️', 250, 'connections', 50, 'gold'),
('connections_100', 'Super Connector', 'Add 100 people to your network', '⭐', 500, 'connections', 100, 'platinum'),

-- Message achievements
('messages_5', 'Ice Breaker', 'Send 5 outreach messages', '💬', 30, 'messages', 5, 'bronze'),
('messages_25', 'Conversation Starter', 'Send 25 outreach messages', '📨', 125, 'messages', 25, 'silver'),
('messages_50', 'Outreach Pro', 'Send 50 outreach messages', '📧', 275, 'messages', 50, 'gold'),
('messages_100', 'Networking Legend', 'Send 100 outreach messages', '🏆', 600, 'messages', 100, 'platinum')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- UPDATE EXISTING ALUMNI WITH CORNELL SCHOOL_ID
-- ============================================
UPDATE public.alumni 
SET school_id = (SELECT id FROM public.schools WHERE slug = 'cornell')
WHERE school_id IS NULL;

-- ============================================
-- FUNCTIONS FOR GAMIFICATION
-- ============================================

-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Level formula: each level requires 100 * level XP
    -- Level 1: 0-99, Level 2: 100-299, Level 3: 300-599, etc.
    RETURN FLOOR(SQRT(xp / 50)) + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_last_date DATE;
    v_today DATE := CURRENT_DATE;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
BEGIN
    SELECT last_activity_date, current_streak, longest_streak 
    INTO v_last_date, v_current_streak, v_longest_streak
    FROM public.user_stats 
    WHERE user_id = p_user_id;
    
    IF v_last_date IS NULL THEN
        -- First activity ever
        INSERT INTO public.user_stats (user_id, current_streak, longest_streak, last_activity_date)
        VALUES (p_user_id, 1, 1, v_today)
        ON CONFLICT (user_id) DO UPDATE SET
            current_streak = 1,
            longest_streak = GREATEST(user_stats.longest_streak, 1),
            last_activity_date = v_today;
    ELSIF v_last_date = v_today THEN
        -- Already active today, do nothing
        NULL;
    ELSIF v_last_date = v_today - 1 THEN
        -- Consecutive day - increment streak
        UPDATE public.user_stats SET
            current_streak = current_streak + 1,
            longest_streak = GREATEST(longest_streak, current_streak + 1),
            last_activity_date = v_today,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    ELSE
        -- Streak broken - reset to 1
        UPDATE public.user_stats SET
            current_streak = 1,
            last_activity_date = v_today,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add XP
CREATE OR REPLACE FUNCTION add_user_xp(p_user_id UUID, p_xp INTEGER)
RETURNS void AS $$
BEGIN
    INSERT INTO public.user_stats (user_id, total_xp, current_level)
    VALUES (p_user_id, p_xp, calculate_level(p_xp))
    ON CONFLICT (user_id) DO UPDATE SET
        total_xp = user_stats.total_xp + p_xp,
        current_level = calculate_level(user_stats.total_xp + p_xp),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and unlock achievements
CREATE OR REPLACE FUNCTION check_achievements(p_user_id UUID)
RETURNS TABLE(achievement_slug TEXT, achievement_name TEXT, xp_earned INTEGER) AS $$
DECLARE
    v_stats RECORD;
    v_achievement RECORD;
BEGIN
    -- Get user stats
    SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_user_id;
    
    -- Check each achievement
    FOR v_achievement IN 
        SELECT a.* FROM public.achievements a
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_achievements ua 
            WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
        )
    LOOP
        -- Check if requirement is met
        IF (v_achievement.requirement_type = 'streak' AND v_stats.current_streak >= v_achievement.requirement_value) OR
           (v_achievement.requirement_type = 'connections' AND v_stats.total_connections >= v_achievement.requirement_value) OR
           (v_achievement.requirement_type = 'messages' AND v_stats.total_messages_sent >= v_achievement.requirement_value)
        THEN
            -- Unlock achievement
            INSERT INTO public.user_achievements (user_id, achievement_id)
            VALUES (p_user_id, v_achievement.id);
            
            -- Add XP
            PERFORM add_user_xp(p_user_id, v_achievement.xp_reward);
            
            -- Return the unlocked achievement
            achievement_slug := v_achievement.slug;
            achievement_name := v_achievement.name;
            xp_earned := v_achievement.xp_reward;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
