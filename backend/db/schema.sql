CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('organizer','judge','participant')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  venue VARCHAR(200) NOT NULL DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
  status TEXT NOT NULL CHECK (status IN ('draft','published','completed')),
  rubric JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, event_id),
  UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  track_id UUID,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  max_score INTEGER NOT NULL CHECK (max_score BETWEEN 1 AND 100),
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 11),
  FOREIGN KEY (track_id, event_id) REFERENCES tracks(id, event_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS rubric_criteria_event_name_idx ON rubric_criteria(event_id, lower(name)) WHERE track_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rubric_criteria_track_name_idx ON rubric_criteria(track_id, lower(name)) WHERE track_id IS NOT NULL;

INSERT INTO rubric_criteria(id,event_id,track_id,name,description,max_score,position)
SELECT (criterion->>'id')::uuid, e.id, NULL, criterion->>'name', COALESCE(criterion->>'description',''),
       COALESCE(NULLIF(criterion->>'maxScore','')::integer,10), (item.ordinality - 1)::smallint
FROM events e CROSS JOIN LATERAL jsonb_array_elements(e.rubric) WITH ORDINALITY AS item(criterion,ordinality)
WHERE criterion->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  name VARCHAR(80) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID NOT NULL REFERENCES users(id),
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 5),
  PRIMARY KEY (team_id, user_id),
  UNIQUE (event_id, user_id),
  UNIQUE (team_id, position)
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id),
  title VARCHAR(150) NOT NULL,
  summary VARCHAR(2000) NOT NULL,
  repository_url VARCHAR(500) NOT NULL DEFAULT '',
  demo_url VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES tracks(id);

CREATE TABLE IF NOT EXISTS judge_assignments (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  judge_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (event_id, judge_id)
);

CREATE TABLE IF NOT EXISTS judge_track_eligibility (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  track_id UUID NOT NULL,
  judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (track_id, event_id) REFERENCES tracks(id, event_id) ON DELETE CASCADE,
  UNIQUE (track_id, judge_id)
);

CREATE TABLE IF NOT EXISTS judging_assignments (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','completed')),
  overall_feedback VARCHAR(2000) NOT NULL DEFAULT '',
  assigned_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (submission_id, judge_id),
  UNIQUE (id, submission_id, event_id, judge_id)
);

CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES users(id),
  criterion_id UUID NOT NULL REFERENCES rubric_criteria(id),
  judging_assignment_id UUID NOT NULL REFERENCES judging_assignments(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0),
  feedback VARCHAR(2000) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (judging_assignment_id, criterion_id),
  FOREIGN KEY (judging_assignment_id, submission_id, event_id, judge_id)
    REFERENCES judging_assignments(id, submission_id, event_id, judge_id) ON DELETE CASCADE
);

-- Upgrade databases created by the earlier JSON-backed/PostgreSQL schema.
ALTER TABLE scores ADD COLUMN IF NOT EXISTS judging_assignment_id UUID;
INSERT INTO judging_assignments(id,event_id,submission_id,judge_id,status,assigned_at,started_at,completed_at)
SELECT gen_random_uuid(),legacy.event_id,legacy.submission_id,legacy.judge_id,'in_progress',now(),now(),NULL
FROM (SELECT DISTINCT event_id,submission_id,judge_id FROM scores) legacy
WHERE NOT EXISTS (SELECT 1 FROM judging_assignments ja WHERE ja.submission_id=legacy.submission_id AND ja.judge_id=legacy.judge_id);
UPDATE scores s SET judging_assignment_id=ja.id
FROM judging_assignments ja
WHERE ja.submission_id=s.submission_id AND ja.judge_id=s.judge_id AND s.judging_assignment_id IS NULL;
ALTER TABLE scores ALTER COLUMN judging_assignment_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE scores ADD CONSTRAINT scores_assignment_criterion_unique UNIQUE (judging_assignment_id, criterion_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE scores ADD CONSTRAINT scores_criterion_id_fkey FOREIGN KEY (criterion_id) REFERENCES rubric_criteria(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE scores ADD CONSTRAINT scores_judging_assignment_id_fkey FOREIGN KEY (judging_assignment_id) REFERENCES judging_assignments(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE judging_assignments ADD CONSTRAINT judging_assignments_score_link_unique UNIQUE(id,submission_id,event_id,judge_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE scores ADD CONSTRAINT scores_assignment_scope_fkey FOREIGN KEY (judging_assignment_id,submission_id,event_id,judge_id) REFERENCES judging_assignments(id,submission_id,event_id,judge_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS events_organizer_idx ON events(organizer_id);
CREATE INDEX IF NOT EXISTS tracks_event_idx ON tracks(event_id);
CREATE INDEX IF NOT EXISTS teams_event_idx ON teams(event_id);
CREATE INDEX IF NOT EXISTS submissions_team_idx ON submissions(team_id);
CREATE INDEX IF NOT EXISTS submissions_track_idx ON submissions(track_id);
CREATE INDEX IF NOT EXISTS assignments_judge_idx ON judge_assignments(judge_id, event_id);
CREATE INDEX IF NOT EXISTS eligibility_judge_track_idx ON judge_track_eligibility(judge_id, track_id);
CREATE INDEX IF NOT EXISTS judging_assignments_judge_status_idx ON judging_assignments(judge_id, status);
CREATE INDEX IF NOT EXISTS scores_submission_idx ON scores(submission_id, judge_id);
