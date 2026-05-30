-- Copyright (c) 2026 RAJ.Y — All rights reserved.
-- CH_Eleven Fantasy Cricket Platform
-- CH_Eleven Database Schema
-- Auto-runs on first container start via docker-entrypoint-initdb.d

CREATE TABLE IF NOT EXISTS match_info (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL DEFAULT 'ICT Hand Cricket',
  team_a         TEXT NOT NULL DEFAULT 'ICT Blue',
  team_b         TEXT NOT NULL DEFAULT 'ICT Red',
  match_date     DATE DEFAULT CURRENT_DATE,
  venue          TEXT DEFAULT '',
  overs          INTEGER DEFAULT 10,
  status         TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','completed')),
  innings_loaded INTEGER DEFAULT 0,
  result         TEXT DEFAULT '',
  team_a_score   TEXT DEFAULT '',
  team_b_score   TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Seed one match row so the API always returns something
INSERT INTO match_info (name, team_a, team_b, match_date, overs, status)
VALUES ('ICT Hand Cricket - Match #12', 'ICT Blue', 'ICT Red', CURRENT_DATE, 10, 'upcoming')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  cric_team     TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'BAT' CHECK (role IN ('BAT','BOWL','AR','WK')),
  -- batting
  runs          INTEGER DEFAULT 0,
  balls_faced   INTEGER DEFAULT 0,
  fours         INTEGER DEFAULT 0,
  sixes         INTEGER DEFAULT 0,
  duck          BOOLEAN DEFAULT FALSE,
  -- bowling
  wickets       INTEGER DEFAULT 0,
  overs_bowled  NUMERIC(5,1) DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  maidens       INTEGER DEFAULT 0,
  -- fielding
  catches       INTEGER DEFAULT 0,
  stumpings     INTEGER DEFAULT 0,
  ro_direct     INTEGER DEFAULT 0,
  ro_indirect   INTEGER DEFAULT 0,
  -- status
  did_not_play  BOOLEAN DEFAULT FALSE,
  -- admin override
  manual_points NUMERIC(6,1) DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contest_teams (
  id            SERIAL PRIMARY KEY,
  owner_name    TEXT NOT NULL,
  player_ids    INTEGER[] NOT NULL,
  captain_id    INTEGER NOT NULL,
  vc_id         INTEGER NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_owner_name UNIQUE (owner_name)
);

CREATE TABLE IF NOT EXISTS contest_settings (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  max_entries INTEGER DEFAULT 50,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO contest_settings (id, max_entries) VALUES (1, 50) ON CONFLICT DO NOTHING;

-- Helper: auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER players_touch
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE TRIGGER match_touch
  BEFORE UPDATE ON match_info
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
