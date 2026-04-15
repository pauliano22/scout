-- Migration 006: Simplify Networking
-- Adds intake/onboarding columns to profiles, creates networking_plans, plan_alumni, plan_custom_contacts tables

-- ============================================
-- 1. Add intake columns to profiles
-- ============================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS primary_industry text,
  ADD COLUMN IF NOT EXISTS target_roles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_industries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS networking_intensity text DEFAULT 'own_pace'
    CHECK (networking_intensity IN ('20', '10', '5', 'own_pace')),
  ADD COLUMN IF NOT EXISTS current_stage text DEFAULT 'exploring'
    CHECK (current_stage IN ('exploring', 'recruiting', 'interviewing', 'referrals', 'relationship_building')),
  ADD COLUMN IF NOT EXISTS existing_network text DEFAULT 'none'
    CHECK (existing_network IN ('none', 'few_conversations', 'ongoing')),
  ADD COLUMN IF NOT EXISTS major text,
  ADD COLUMN IF NOT EXISTS past_experience text,
  ADD COLUMN IF NOT EXISTS preferred_locations text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS geography_preference text DEFAULT 'doesnt_matter'
    CHECK (geography_preference IN ('city', 'region', 'doesnt_matter')),
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- ============================================
-- 2. Create networking_plans table
-- ============================================

CREATE TABLE IF NOT EXISTS networking_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'My Networking Plan',
  goal_count integer DEFAULT 10,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. Create plan_alumni table
-- ============================================

CREATE TABLE IF NOT EXISTS plan_alumni (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES networking_plans(id) ON DELETE CASCADE NOT NULL,
  alumni_id uuid REFERENCES alumni(id) ON DELETE CASCADE NOT NULL,
  ai_career_summary text,
  ai_talking_points jsonb DEFAULT '[]',
  ai_recommendation_reason text,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'not_interested', 'contacted')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, alumni_id)
);

-- ============================================
-- 4. Create plan_custom_contacts table
-- ============================================

CREATE TABLE IF NOT EXISTS plan_custom_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES networking_plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  company text,
  role text,
  linkedin_url text,
  notes text,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'not_interested', 'contacted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 5. Trigger: auto-sync plan_alumni to user_networks
-- ============================================

CREATE OR REPLACE FUNCTION sync_plan_alumni_to_network()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_networks (user_id, alumni_id, contacted, status)
  SELECT np.user_id, NEW.alumni_id, false, 'interested'
  FROM networking_plans np
  WHERE np.id = NEW.plan_id
  ON CONFLICT (user_id, alumni_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_plan_alumni ON plan_alumni;
CREATE TRIGGER trigger_sync_plan_alumni
  AFTER INSERT ON plan_alumni
  FOR EACH ROW
  EXECUTE FUNCTION sync_plan_alumni_to_network();

-- ============================================
-- 6. Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_networking_plans_user_id ON networking_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_networking_plans_active ON networking_plans(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_plan_alumni_plan_id ON plan_alumni(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_alumni_alumni_id ON plan_alumni(alumni_id);
CREATE INDEX IF NOT EXISTS idx_plan_alumni_status ON plan_alumni(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_plan_custom_contacts_plan_id ON plan_custom_contacts(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_custom_contacts_user_id ON plan_custom_contacts(user_id);

-- ============================================
-- 7. RLS Policies
-- ============================================

ALTER TABLE networking_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_alumni ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_custom_contacts ENABLE ROW LEVEL SECURITY;

-- networking_plans policies
CREATE POLICY "Users can view own plans"
  ON networking_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plans"
  ON networking_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON networking_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
  ON networking_plans FOR DELETE
  USING (auth.uid() = user_id);

-- plan_alumni policies
CREATE POLICY "Users can view own plan alumni"
  ON plan_alumni FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM networking_plans np
      WHERE np.id = plan_alumni.plan_id AND np.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own plan alumni"
  ON plan_alumni FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM networking_plans np
      WHERE np.id = plan_alumni.plan_id AND np.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own plan alumni"
  ON plan_alumni FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM networking_plans np
      WHERE np.id = plan_alumni.plan_id AND np.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own plan alumni"
  ON plan_alumni FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM networking_plans np
      WHERE np.id = plan_alumni.plan_id AND np.user_id = auth.uid()
    )
  );

-- plan_custom_contacts policies
CREATE POLICY "Users can view own custom contacts"
  ON plan_custom_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own custom contacts"
  ON plan_custom_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom contacts"
  ON plan_custom_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom contacts"
  ON plan_custom_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 8. Add unique constraint on user_networks if missing
-- (needed for ON CONFLICT in the trigger)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_networks_user_id_alumni_id_key'
  ) THEN
    ALTER TABLE user_networks ADD CONSTRAINT user_networks_user_id_alumni_id_key
      UNIQUE (user_id, alumni_id);
  END IF;
END $$;

-- ============================================
-- 9. Updated_at triggers for new tables
-- ============================================

CREATE TRIGGER update_networking_plans_updated_at
  BEFORE UPDATE ON networking_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_plan_alumni_updated_at
  BEFORE UPDATE ON plan_alumni
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_plan_custom_contacts_updated_at
  BEFORE UPDATE ON plan_custom_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
