/*
  # Power Teams Weekly Championship Schema

  ## Tables

  ### teams
  - Four fixed teams: Civil, HNI, C & II, Lifestyle
  - id, name, color (for UI theming)

  ### weekly_scores
  - One row per team per week_id (ISO week string e.g. "2026-W21")
  - Stores raw scores for each category, computed rank & points handled in app/db
  - Columns: id, week_id, team_id, green_score_pct, business_amount, visitor_count, star_of_week_rank
    - star_of_week_rank: 1-4 (rank awarded by management, 0 = not ranked)
  - points columns are stored after computation for transparency

  ## Security
  - RLS enabled on both tables
  - teams: public read
  - weekly_scores: public read, authenticated insert/update (admin only)
*/

-- Teams lookup table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view teams"
  ON teams FOR SELECT
  TO anon, authenticated
  USING (true);

-- Seed the four fixed teams
INSERT INTO teams (name, color) VALUES
  ('Civil',     '#0EA5E9'),
  ('HNI',       '#10B981'),
  ('C & II',    '#F59E0B'),
  ('Lifestyle', '#EF4444')
ON CONFLICT (name) DO NOTHING;

-- Weekly scores table
CREATE TABLE IF NOT EXISTS weekly_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id text NOT NULL,              -- e.g. "2026-W21"
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  green_score_pct numeric(5,2) DEFAULT 0,   -- raw percentage value
  business_amount numeric(15,2) DEFAULT 0,  -- raw revenue value
  visitor_count integer DEFAULT 0,
  star_rank integer DEFAULT 0,              -- 1-4 rank given by management (0 = unranked)
  -- computed points stored for display
  green_points integer DEFAULT 0,
  business_points integer DEFAULT 0,
  visitor_points integer DEFAULT 0,
  star_points integer DEFAULT 0,
  total_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (week_id, team_id)
);

ALTER TABLE weekly_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view weekly scores"
  ON weekly_scores FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scores"
  ON weekly_scores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scores"
  ON weekly_scores FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS weekly_scores_updated_at ON weekly_scores;
CREATE TRIGGER weekly_scores_updated_at
  BEFORE UPDATE ON weekly_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
