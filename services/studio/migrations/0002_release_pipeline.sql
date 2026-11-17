CREATE TABLE IF NOT EXISTS studio_multipart_uploads (
  film_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('video')),
  upload_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  expected_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (film_id, kind),
  FOREIGN KEY (film_id) REFERENCES studio_films(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_release_requests (
  film_id TEXT PRIMARY KEY,
  request_json TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'owner_approval_required'
    CHECK (status IN ('owner_approval_required', 'approved', 'rejected', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (film_id) REFERENCES studio_films(id) ON DELETE CASCADE
);
