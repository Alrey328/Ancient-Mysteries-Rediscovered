import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const ORIGIN = 'https://ancientmysteriesrediscovered.com';
const SECRET = 'test-only-secret-with-at-least-32-characters';
const VISITOR = '123e4567-e89b-42d3-a456-426614174000';

class MockD1 {
  constructor() {
    this.likes = new Set();
    this.views = new Set();
    this.rates = new Map();
    this.counts = new Map([
      ['enuk', { likes: 0, views: 0 }],
      ['laestrygonians', { likes: 0, views: 0 }]
    ]);
    this.fail = false;
  }

  prepare(sql) {
    if (this.fail) throw new Error('simulated D1 failure');
    const normalized = sql.replace(/\s+/g, ' ').trim();
    let values = [];
    const statement = {
      bind: (...bindings) => { values = bindings; return statement; },
      first: async () => {
        if (normalized.startsWith('SELECT likes, views FROM engagement_totals')) {
          return { ...this.counts.get(values[0]) };
        }
        if (normalized.startsWith('INSERT INTO rate_events')) {
          const key = `${values[0]}|${values[1]}|${values[2]}`;
          const current = this.rates.get(key) || 0;
          if (current >= values[3]) return null;
          const count = current + 1;
          this.rates.set(key, count);
          return { count };
        }
        throw new Error(`Unhandled first(): ${normalized}`);
      },
      run: async () => {
        if (normalized.startsWith('INSERT OR IGNORE INTO likes')) {
          const key = `${values[0]}|${values[1]}`;
          if (!this.likes.has(key)) {
            this.likes.add(key);
            this.counts.get(values[0]).likes += 1;
          }
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith('DELETE FROM likes')) {
          const key = `${values[0]}|${values[1]}`;
          if (this.likes.delete(key)) this.counts.get(values[0]).likes -= 1;
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith('INSERT OR IGNORE INTO qualified_views')) {
          const key = `${values[0]}|${values[1]}|${values[2]}`;
          if (!this.views.has(key)) {
            this.views.add(key);
            this.counts.get(values[0]).views += 1;
          }
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith('DELETE FROM rate_events')) return { meta: { changes: 0 } };
        throw new Error(`Unhandled run(): ${normalized}`);
      }
    };
    return statement;
  }
}

function env(db = new MockD1()) {
  return { DB: db, VISITOR_HASH_SECRET: SECRET };
}

function request(path, { method = 'GET', body, origin = ORIGIN, ip = '203.0.113.9', headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (origin !== null) requestHeaders.set('Origin', origin);
  if (ip !== null) requestHeaders.set('CF-Connecting-IP', ip);
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  return new Request(`https://worker.example${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function jsonResponse(response) {
  return { status: response.status, headers: response.headers, body: await response.json() };
}

test('GET returns point-read totals and production CORS', async () => {
  const result = await jsonResponse(await worker.fetch(request('/videos/enuk'), env(), {}));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { likes: 0, views: 0 });
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});

test('like and unlike are idempotent', async () => {
  const db = new MockD1();
  const bindings = env(db);
  const like = () => worker.fetch(request('/videos/enuk/like', {
    method: 'PUT', body: { visitorKey: VISITOR }
  }), bindings, {});
  assert.deepEqual((await jsonResponse(await like())).body, { likes: 1, views: 0 });
  assert.deepEqual((await jsonResponse(await like())).body, { likes: 1, views: 0 });
  const unlike = await worker.fetch(request('/videos/enuk/like', {
    method: 'DELETE', body: { visitorKey: VISITOR }
  }), bindings, {});
  assert.deepEqual((await jsonResponse(unlike)).body, { likes: 0, views: 0 });
});

test('qualified views deduplicate by visitor, video, and UTC day', async () => {
  const db = new MockD1();
  const bindings = env(db);
  const view = () => worker.fetch(request('/videos/laestrygonians/view', {
    method: 'POST', body: { visitorKey: VISITOR, qualifiedSeconds: 3 }
  }), bindings, {});
  assert.deepEqual((await jsonResponse(await view())).body, { likes: 0, views: 1 });
  assert.deepEqual((await jsonResponse(await view())).body, { likes: 0, views: 1 });
});

test('preflight permits only an AMR origin', async () => {
  const allowed = await worker.fetch(request('/videos/enuk/like', { method: 'OPTIONS' }), env(), {});
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const denied = await worker.fetch(request('/videos/enuk/like', {
    method: 'OPTIONS', origin: 'https://attacker.example'
  }), env(), {});
  assert.equal(denied.status, 403);
});

test('an exact temporary preview origin can be configured without wildcard CORS', async () => {
  const previewOrigin = 'http://127.0.0.1:4173';
  const bindings = { ...env(), PREVIEW_ORIGIN: previewOrigin };
  const allowed = await worker.fetch(request('/videos/enuk/like', {
    method: 'OPTIONS', origin: previewOrigin
  }), bindings, {});
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), previewOrigin);
  const nearMatch = await worker.fetch(request('/videos/enuk/like', {
    method: 'OPTIONS', origin: `${previewOrigin}.attacker.example`
  }), bindings, {});
  assert.equal(nearMatch.status, 403);
});

test('mutations reject missing origins, invalid visitors, and invalid thresholds', async () => {
  const bindings = env();
  const noOrigin = await worker.fetch(request('/videos/enuk/like', {
    method: 'PUT', body: { visitorKey: VISITOR }, origin: null
  }), bindings, {});
  assert.equal(noOrigin.status, 403);
  const visitor = await worker.fetch(request('/videos/enuk/like', {
    method: 'PUT', body: { visitorKey: 'not-a-uuid' }
  }), bindings, {});
  assert.equal(visitor.status, 400);
  const threshold = await worker.fetch(request('/videos/enuk/view', {
    method: 'POST', body: { visitorKey: VISITOR, qualifiedSeconds: 2 }
  }), bindings, {});
  assert.equal(threshold.status, 400);
});

test('oversized and malformed payloads fail safely', async () => {
  const oversized = new Request('https://worker.example/videos/enuk/like', {
    method: 'PUT',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: `{"visitorKey":"${'x'.repeat(9000)}"}`
  });
  assert.equal((await worker.fetch(oversized, env(), {})).status, 413);
  const malformed = new Request('https://worker.example/videos/enuk/like', {
    method: 'PUT', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{'
  });
  assert.equal((await worker.fetch(malformed, env(), {})).status, 400);
});

test('rate limiting returns 429 with Retry-After', async () => {
  const bindings = env();
  let response;
  for (let index = 0; index < 7; index += 1) {
    response = await worker.fetch(request('/videos/enuk/view', {
      method: 'POST',
      body: { visitorKey: `123e4567-e89b-42d3-a456-42661417400${index}`, qualifiedSeconds: 3 }
    }), bindings, {});
  }
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
});

test('configuration and D1 failures return generic 503 JSON', async () => {
  const missing = await worker.fetch(request('/videos/enuk'), { DB: new MockD1() }, {});
  assert.equal(missing.status, 503);
  const db = new MockD1();
  db.fail = true;
  const failed = await jsonResponse(await worker.fetch(request('/videos/enuk'), env(db), {}));
  assert.equal(failed.status, 503);
  assert.deepEqual(failed.body, { error: 'AMR service temporarily unavailable' });
});

test('unknown videos and disallowed methods are rejected', async () => {
  assert.equal((await worker.fetch(request('/videos/youtube'), env(), {})).status, 404);
  const method = await worker.fetch(request('/videos/enuk', { method: 'POST' }), env(), {});
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('Allow'), 'GET, OPTIONS');
});
