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
CREATE INDEX IF NOT EXISTS idx_views_video ON qualified_views(video_id);
