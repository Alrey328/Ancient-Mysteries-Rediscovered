import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const schemaUrl = new URL('../schema.sql', import.meta.url);
const schema = fs.readFileSync(fileURLToPath(schemaUrl), 'utf8');

function oldSchema(database) {
  database.exec(`
    CREATE TABLE likes (
      video_id TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (video_id, visitor_hash)
    );
    CREATE TABLE qualified_views (
      video_id TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      view_day TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (video_id, visitor_hash, view_day)
    );
    CREATE TABLE rate_events (
      visitor_hash TEXT NOT NULL,
      action TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (visitor_hash, action, window_start)
    );
  `);
}

test('schema migrates existing events and maintains exact idempotent totals', () => {
  const database = new DatabaseSync(':memory:');
  oldSchema(database);
  database.exec(`
    INSERT INTO likes (video_id, visitor_hash) VALUES ('enuk', 'visitor-a');
    INSERT INTO qualified_views (video_id, visitor_hash, view_day)
      VALUES ('laestrygonians', 'visitor-b', '2026-11-04');
  `);
  database.exec(schema);

  const enuk = database.prepare('SELECT likes, views FROM engagement_totals WHERE video_id = ?').get('enuk');
  assert.equal(enuk.likes, 1);
  assert.equal(enuk.views, 0);
  const laestrygonians = database.prepare(
    'SELECT likes, views FROM engagement_totals WHERE video_id = ?'
  ).get('laestrygonians');
  assert.equal(laestrygonians.likes, 0);
  assert.equal(laestrygonians.views, 1);
  const landOfTheDead = database.prepare(
    'SELECT likes, views FROM engagement_totals WHERE video_id = ?'
  ).get('land-of-the-dead');
  assert.equal(landOfTheDead.likes, 0);
  assert.equal(landOfTheDead.views, 0);

  database.exec(`
    INSERT OR IGNORE INTO likes (video_id, visitor_hash) VALUES ('enuk', 'visitor-a');
    INSERT OR IGNORE INTO likes (video_id, visitor_hash) VALUES ('enuk', 'visitor-c');
    INSERT OR IGNORE INTO qualified_views (video_id, visitor_hash, view_day)
      VALUES ('laestrygonians', 'visitor-b', '2026-11-04');
  `);
  const updatedEnuk = database.prepare(
    'SELECT likes, views FROM engagement_totals WHERE video_id = ?'
  ).get('enuk');
  assert.equal(updatedEnuk.likes, 2);
  assert.equal(updatedEnuk.views, 0);
  database.exec("DELETE FROM likes WHERE video_id = 'enuk' AND visitor_hash = 'visitor-c'");
  assert.equal(database.prepare("SELECT likes FROM engagement_totals WHERE video_id = 'enuk'").get().likes, 1);
  database.exec(`
    DELETE FROM qualified_views
    WHERE video_id = 'laestrygonians'
      AND visitor_hash = 'visitor-b'
      AND view_day = '2026-11-04'
  `);
  assert.equal(
    database.prepare("SELECT views FROM engagement_totals WHERE video_id = 'laestrygonians'").get().views,
    0
  );

  // Reapplying the idempotent migration must reconcile without double-counting.
  database.exec(schema);
  assert.equal(database.prepare("SELECT likes FROM engagement_totals WHERE video_id = 'enuk'").get().likes, 1);
  assert.equal(
    database.prepare("SELECT views FROM engagement_totals WHERE video_id = 'laestrygonians'").get().views,
    0
  );
  database.close();
});

test('retention cleanup can use the window_start index', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(schema);
  const plan = database.prepare('EXPLAIN QUERY PLAN DELETE FROM rate_events WHERE window_start < ?').all(100);
  assert.ok(plan.some(row => String(row.detail).includes('idx_rate_events_window')), JSON.stringify(plan));
  database.close();
});
