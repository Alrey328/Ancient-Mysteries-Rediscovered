CREATE TABLE IF NOT EXISTS likes (
  video_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (video_id, visitor_hash)
);

CREATE TABLE IF NOT EXISTS qualified_views (
  video_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  view_day TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (video_id, visitor_hash, view_day)
);

CREATE TABLE IF NOT EXISTS rate_events (
  visitor_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor_hash, action, window_start)
);

CREATE TABLE IF NOT EXISTS engagement_totals (
  video_id TEXT PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0)
);

INSERT OR IGNORE INTO engagement_totals (video_id) VALUES ('enuk');
INSERT OR IGNORE INTO engagement_totals (video_id) VALUES ('laestrygonians');
INSERT OR IGNORE INTO engagement_totals (video_id) VALUES ('land-of-the-dead');

CREATE TRIGGER IF NOT EXISTS likes_after_insert
AFTER INSERT ON likes
BEGIN
  UPDATE engagement_totals SET likes = likes + 1 WHERE video_id = NEW.video_id;
END;

CREATE TRIGGER IF NOT EXISTS likes_after_delete
AFTER DELETE ON likes
BEGIN
  UPDATE engagement_totals
  SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END
  WHERE video_id = OLD.video_id;
END;

CREATE TRIGGER IF NOT EXISTS qualified_views_after_insert
AFTER INSERT ON qualified_views
BEGIN
  UPDATE engagement_totals SET views = views + 1 WHERE video_id = NEW.video_id;
END;

CREATE TRIGGER IF NOT EXISTS qualified_views_after_delete
AFTER DELETE ON qualified_views
BEGIN
  UPDATE engagement_totals
  SET views = CASE WHEN views > 0 THEN views - 1 ELSE 0 END
  WHERE video_id = OLD.video_id;
END;

-- Reconcile counters when this migration is applied to an existing database.
UPDATE engagement_totals
SET likes = (SELECT COUNT(*) FROM likes WHERE likes.video_id = engagement_totals.video_id),
    views = (SELECT COUNT(*) FROM qualified_views WHERE qualified_views.video_id = engagement_totals.video_id);

CREATE INDEX IF NOT EXISTS idx_rate_events_window ON rate_events (window_start);
