-- Scout Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    sport TEXT,
    graduation_year INTEGER,
    interests TEXT,
    is_alumni BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ALUMNI TABLE (the main directory)
-- ============================================
CREATE TABLE public.alumni (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    -- Basic Info
    full_name TEXT NOT NULL,
    email TEXT,
    linkedin_url TEXT,
    
    -- Cornell Athletics Info
    sport TEXT NOT NULL,
    graduation_year INTEGER NOT NULL,
    
    -- Career Info
    company TEXT,
    role TEXT,
    industry TEXT,
    location TEXT,
    
    -- Metadata
    is_verified BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    source TEXT, -- 'opt_in', 'public_record', 'referral'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- USER NETWORKS (connections)
-- ============================================
CREATE TABLE public.user_networks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    alumni_id UUID REFERENCES public.alumni(id) ON DELETE CASCADE NOT NULL,
    contacted BOOLEAN DEFAULT false,
    contacted_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, alumni_id)
);

-- ============================================
-- MESSAGE HISTORY (track outreach)
-- ============================================
CREATE TABLE public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    alumni_id UUID REFERENCES public.alumni(id) ON DELETE CASCADE NOT NULL,
    message_content TEXT NOT NULL,
    sent_via TEXT, -- 'linkedin', 'email', 'copied'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_alumni_industry ON public.alumni(industry);
CREATE INDEX idx_alumni_sport ON public.alumni(sport);
CREATE INDEX idx_alumni_company ON public.alumni(company);
CREATE INDEX idx_alumni_graduation_year ON public.alumni(graduation_year);
CREATE INDEX idx_alumni_full_text ON public.alumni USING gin(to_tsvector('english', full_name || ' ' || COALESCE(company, '') || ' ' || COALESCE(role, '')));

CREATE INDEX idx_user_networks_user ON public.user_networks(user_id);
CREATE INDEX idx_user_networks_alumni ON public.user_networks(alumni_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Alumni: all authenticated users can view public alumni
CREATE POLICY "Authenticated users can view public alumni" ON public.alumni
    FOR SELECT TO authenticated USING (is_public = true);

-- User Networks: users can only manage their own network
CREATE POLICY "Users can view own network" ON public.user_networks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own network" ON public.user_networks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own network" ON public.user_networks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from own network" ON public.user_networks
    FOR DELETE USING (auth.uid() = user_id);

-- Messages: users can only see/create their own messages
CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_alumni_updated_at
    BEFORE UPDATE ON public.alumni
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- SEARCH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION search_alumni(
    search_query TEXT DEFAULT NULL,
    filter_industry TEXT DEFAULT NULL,
    filter_sport TEXT DEFAULT NULL,
    filter_company TEXT DEFAULT NULL
)
RETURNS SETOF public.alumni AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.alumni
    WHERE is_public = true
        AND (search_query IS NULL OR 
            to_tsvector('english', full_name || ' ' || COALESCE(company, '') || ' ' || COALESCE(role, '')) 
            @@ plainto_tsquery('english', search_query))
        AND (filter_industry IS NULL OR industry = filter_industry)
        AND (filter_sport IS NULL OR sport = filter_sport)
        AND (filter_company IS NULL OR company ILIKE '%' || filter_company || '%')
    ORDER BY graduation_year DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
