CREATE TABLE IF NOT EXISTS roster_entries (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  team_years TEXT,
  graduation_year INT,
  sport_category TEXT,
  source TEXT DEFAULT 'import',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_entries_unique
  ON roster_entries (full_name, sport, COALESCE(graduation_year::TEXT, '0'));
