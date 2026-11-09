CREATE TABLE IF NOT EXISTS studio_films (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  video_key TEXT,
  video_name TEXT,
  video_bytes INTEGER,
  poster_key TEXT,
  poster_name TEXT,
  poster_bytes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS studio_films_updated_at
  ON studio_films(updated_at DESC);

CREATE TABLE IF NOT EXISTS studio_login_attempts (
  ip_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);
