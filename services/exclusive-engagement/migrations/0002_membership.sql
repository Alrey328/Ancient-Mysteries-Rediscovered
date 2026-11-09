-- AMR membership, native comments, and notification preferences.
-- Additive only: existing anonymous likes, views, and totals remain untouched.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  google_subject_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_sign_in_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS member_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS member_likes (
  video_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (video_id, member_id)
);

CREATE TRIGGER IF NOT EXISTS member_likes_after_insert
AFTER INSERT ON member_likes
BEGIN
  UPDATE engagement_totals SET likes = likes + 1 WHERE video_id = NEW.video_id;
END;

CREATE TRIGGER IF NOT EXISTS member_likes_after_delete
AFTER DELETE ON member_likes
BEGIN
  UPDATE engagement_totals
  SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END
  WHERE video_id = OLD.video_id;
END;

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS comment_reports (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'misinformation', 'other')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (comment_id, reporter_member_id)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  cinema_releases INTEGER NOT NULL DEFAULT 0 CHECK (cinema_releases IN (0, 1)),
  investigations INTEGER NOT NULL DEFAULT 0 CHECK (investigations IN (0, 1)),
  series_chapters INTEGER NOT NULL DEFAULT 0 CHECK (series_chapters IN (0, 1)),
  consent_version TEXT,
  consented_at INTEGER,
  unsubscribe_version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS release_events (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('cinema', 'investigation', 'series')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published')),
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES release_events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'suppressed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at INTEGER,
  PRIMARY KEY (member_id, release_id)
);

CREATE TABLE IF NOT EXISTS moderation_audit (
  id TEXT PRIMARY KEY,
  moderator_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  comment_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'restore')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_member_expiry
  ON member_sessions (member_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_comments_video_created
  ON comments (video_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_comment
  ON comment_reports (comment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_status_created
  ON notification_deliveries (status, created_at);
CREATE INDEX IF NOT EXISTS idx_releases_published
  ON release_events (status, published_at);
