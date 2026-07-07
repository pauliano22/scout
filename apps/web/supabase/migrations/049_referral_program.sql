-- ============================================
-- REFERRAL PROGRAM SCHEMA
-- Migration 006
-- ============================================

-- ============================================
-- REFERRAL LINKS TABLE
-- Each alumni gets a unique referral code that
-- they can share with teammates/contacts.
-- ============================================

CREATE TABLE public.referral_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The user who created the referral link
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Unique referral code (short, human-readable)
  code TEXT UNIQUE NOT NULL,

  -- Whether this referral link is active
  is_active BOOLEAN DEFAULT true,

  -- How many times this code has been redeemed
  redemption_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- REFERRAL REDEMPTIONS TABLE
-- Tracks each time a referral code is used.
-- ============================================

CREATE TABLE public.referral_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The referral link that was used
  referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE CASCADE NOT NULL,

  -- The user who redeemed the code (if they signed up)
  redeemed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- The email or identifier of the person who used the code (before signup)
  redeemed_by_email TEXT,

  -- The alumni ID that was connected as part of this referral
  connected_alumni_id UUID REFERENCES public.alumni(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_referral_links_user_id ON public.referral_links(user_id);
CREATE INDEX idx_referral_links_code ON public.referral_links(code);
CREATE INDEX idx_referral_redemptions_link ON public.referral_redemptions(referral_link_id);
CREATE INDEX idx_referral_redemptions_redeemed_by ON public.referral_redemptions(redeemed_by_user_id);
CREATE INDEX idx_referral_redemptions_connected_alumni ON public.referral_redemptions(connected_alumni_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

-- Referral links: users can view their own
CREATE POLICY "Users can view own referral links"
  ON public.referral_links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Referral links: users can create their own
CREATE POLICY "Users can create own referral links"
  ON public.referral_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Referral links: users can update their own
CREATE POLICY "Users can update own referral links"
  ON public.referral_links FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Referral redemptions: anyone can read (for leaderboard)
CREATE POLICY "Anyone can view referral redemptions"
  ON public.referral_redemptions FOR SELECT
  TO authenticated
  USING (true);

-- Referral redemptions: authenticated users can insert
CREATE POLICY "Authenticated users can insert redemptions"
  ON public.referral_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_referral_links_updated_at
  BEFORE UPDATE ON public.referral_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- HELPER: GENERATE UNIQUE REFERRAL CODE
-- ============================================

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  done BOOLEAN;
BEGIN
  done := false;
  WHILE NOT done LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.referral_links WHERE code = result) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- ============================================
-- HELPER: INCREMENT REFERRAL COUNT
-- ============================================

CREATE OR REPLACE FUNCTION increment_referral_count(link_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.referral_links
  SET redemption_count = redemption_count + 1
  WHERE id = link_id;
END;
$$;

-- ============================================
-- HELPER: GET REFERRER STATS (for leaderboard)
-- ============================================

CREATE OR REPLACE FUNCTION get_referral_leaderboard(limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  sport TEXT,
  graduation_year INTEGER,
  referral_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rl.user_id,
    p.full_name,
    p.sport,
    p.graduation_year,
    COUNT(rr.id)::BIGINT AS referral_count
  FROM public.referral_links rl
  JOIN public.referral_redemptions rr ON rr.referral_link_id = rl.id
  JOIN public.profiles p ON p.id = rl.user_id
  GROUP BY rl.user_id, p.full_name, p.sport, p.graduation_year
  ORDER BY referral_count DESC
  LIMIT limit_count;
END;
$$;
