-- AI Club schema for Supabase Postgres. Safe to run more than once.
-- Times are Unix milliseconds (bigint); flags are 0/1 integers.

CREATE TABLE IF NOT EXISTS users (
  id                 BIGINT PRIMARY KEY,          -- Telegram user id
  first_name         TEXT,
  last_name          TEXT,
  username           TEXT,
  language_code      TEXT,
  photo_url          TEXT,
  is_premium         INTEGER NOT NULL DEFAULT 0,
  source             TEXT,                        -- first /start payload
  started_at         BIGINT,
  first_app_open_at  BIGINT,
  last_seen_at       BIGINT,
  is_subscribed      INTEGER NOT NULL DEFAULT 0,
  sub_checked_at     BIGINT,
  is_club            INTEGER NOT NULL DEFAULT 0,
  blocked_at         BIGINT,
  created_at         BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT,
  type        TEXT NOT NULL,
  ref         TEXT,
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_type_time ON events(type, created_at);
CREATE INDEX IF NOT EXISTS events_user ON events(user_id);

CREATE TABLE IF NOT EXISTS posts (
  id            BIGSERIAL PRIMARY KEY,
  type          TEXT NOT NULL,                    -- guide | resource | skill | mcp
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',         -- markdown
  cover_url     TEXT,
  link_url      TEXT,
  install       TEXT,
  tags          TEXT NOT NULL DEFAULT '',
  access        TEXT NOT NULL DEFAULT 'channel',  -- free | channel | club
  status        TEXT NOT NULL DEFAULT 'draft',    -- draft | published
  pinned        INTEGER NOT NULL DEFAULT 0,
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL,
  published_at  BIGINT
);

CREATE TABLE IF NOT EXISTS banners (
  id            BIGSERIAL PRIMARY KEY,
  eyebrow       TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  subtitle      TEXT NOT NULL DEFAULT '',
  image_url     TEXT,
  bg            TEXT NOT NULL DEFAULT '#1f1f22',
  cta_label     TEXT NOT NULL DEFAULT '',
  action_type   TEXT NOT NULL DEFAULT 'none',     -- post | page | url | none
  action_value  TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  sort          INTEGER NOT NULL DEFAULT 0,
  starts_at     BIGINT,
  ends_at       BIGINT,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS keywords (
  id             BIGSERIAL PRIMARY KEY,
  keyword        TEXT NOT NULL UNIQUE,
  match_text     INTEGER NOT NULL DEFAULT 1,
  response_text  TEXT NOT NULL,
  photo_url      TEXT,
  buttons        TEXT NOT NULL DEFAULT '[]',
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist (
  user_id     BIGINT NOT NULL,
  product     TEXT NOT NULL,                      -- club | course
  created_at  BIGINT NOT NULL,
  PRIMARY KEY (user_id, product)
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id           BIGSERIAL PRIMARY KEY,
  text         TEXT NOT NULL,
  photo_url    TEXT,
  buttons      TEXT NOT NULL DEFAULT '[]',
  audience     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',    -- queued | sending | done
  total        INTEGER NOT NULL DEFAULT 0,
  sent         INTEGER NOT NULL DEFAULT 0,
  failed       INTEGER NOT NULL DEFAULT 0,
  lock_until   BIGINT,                            -- a step is running until this time
  created_at   BIGINT NOT NULL,
  finished_at  BIGINT
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- The app talks to Postgres directly with the server connection string.
-- Row Level Security with no policies keeps these tables closed to Supabase's public API.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
