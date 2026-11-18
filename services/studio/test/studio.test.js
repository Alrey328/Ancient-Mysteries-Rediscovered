import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import worker, { studioLimits, timingSafeEqual, validMagic } from '../src/index.js';
import { appScript, studioPage } from '../src/ui.js';

const ORIGIN = 'https://studio.example';
const PASSWORD = 'correct-horse-battery-staple';
const SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

class MockD1 {
  constructor() {
    this.films = new Map();
    this.attempts = new Map();
    this.multipart = new Map();
    this.releaseRequests = new Map();
  }

  prepare(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    let values = [];
    const statement = {
      bind: (...bindings) => { values = bindings; return statement; },
      first: async () => {
        if (normalized.startsWith('INSERT INTO studio_login_attempts')) {
          const key = `${values[0]}|${values[1]}`;
          const attempts = (this.attempts.get(key) || 0) + 1;
          this.attempts.set(key, attempts);
          return { attempts };
        }
        if (normalized.startsWith('SELECT * FROM studio_films WHERE id')) return this.films.get(values[0]) || null;
        if (normalized.startsWith('SELECT * FROM studio_multipart_uploads')) return this.multipart.get(values[0]) || null;
        throw new Error(`Unhandled first(): ${normalized}`);
      },
      all: async () => {
        if (normalized.startsWith('SELECT * FROM studio_films ORDER BY')) {
          return { results: [...this.films.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) };
        }
        throw new Error(`Unhandled all(): ${normalized}`);
      },
      run: async () => {
        if (normalized.startsWith('INSERT INTO studio_films')) {
          const [id, slug, title, description, createdAt, updatedAt] = values;
          this.films.set(id, {
            id, slug, title, description, status: 'draft', video_key: null, video_name: null,
            video_bytes: null, poster_key: null, poster_name: null, poster_bytes: null,
            created_at: createdAt, updated_at: updatedAt, published_at: null
          });
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith('INSERT INTO studio_multipart_uploads')) {
          const [filmId, uploadId, objectKey, fileName, expectedBytes, createdAt] = values;
          this.multipart.set(filmId, {
            film_id: filmId, kind: 'video', upload_id: uploadId, object_key: objectKey,
            file_name: fileName, content_type: 'video/mp4', expected_bytes: expectedBytes, created_at: createdAt
          });
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith('DELETE FROM studio_multipart_uploads')) {
          this.multipart.delete(values[0]);
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith('INSERT INTO studio_release_requests')) {
          const [filmId, requestJson, requestDigest, createdAt, updatedAt] = values;
          this.releaseRequests.set(filmId, { film_id: filmId, request_json: requestJson, request_digest: requestDigest, created_at: createdAt, updated_at: updatedAt });
          return { meta: { changes: 1 } };
        }
        const row = this.films.get(values.at(-1));
        if (!row) throw new Error('Missing mock film');
        if (normalized.startsWith('UPDATE studio_films SET title')) {
          [row.title, row.description, row.slug, row.updated_at] = values;
        } else if (normalized.startsWith('UPDATE studio_films SET video_key')) {
          [row.video_key, row.video_name, row.video_bytes, row.updated_at] = values;
        } else if (normalized.startsWith('UPDATE studio_films SET poster_key')) {
          [row.poster_key, row.poster_name, row.poster_bytes, row.updated_at] = values;
        } else if (normalized.startsWith('UPDATE studio_films SET status')) {
          [row.status, row.published_at, row.updated_at] = values;
        } else {
          throw new Error(`Unhandled run(): ${normalized}`);
        }
        return { meta: { changes: 1 } };
      }
    };
    return statement;
  }
}

class MockR2 {
  constructor() { this.objects = new Map(); this.uploads = new Map(); }
  async put(key, value, options) {
    const body = value instanceof ReadableStream ? await new Response(value).arrayBuffer() : value;
    this.objects.set(key, { body, options });
  }
  async get(key, options) {
    const object = this.objects.get(key);
    if (!object) return null;
    let body = object.body;
    let range;
    if (options?.range && typeof options.range.offset === 'number') {
      const offset = options.range.offset;
      const length = options.range.length;
      body = body.slice(offset, offset + length);
      range = { offset, length: body.byteLength };
    }
    return {
      body,
      size: object.body.byteLength,
      range,
      writeHttpMetadata(headers) { headers.set('Content-Type', object.options.httpMetadata.contentType); }
    };
  }
  async createMultipartUpload(key, options) {
    const uploadId = `upload-${this.uploads.size + 1}`;
    this.uploads.set(uploadId, { key, options, parts: new Map() });
    return { key, uploadId };
  }
  resumeMultipartUpload(key, uploadId) {
    const store = this;
    return {
      async uploadPart(partNumber, body) {
        const upload = store.uploads.get(uploadId);
        if (!upload || upload.key !== key) throw new Error('Missing multipart upload');
        const bytes = await new Response(body).arrayBuffer();
        upload.parts.set(partNumber, bytes);
        return { partNumber, etag: `etag-${partNumber}` };
      },
      async complete(parts) {
        const upload = store.uploads.get(uploadId);
        const buffers = parts.map(part => new Uint8Array(upload.parts.get(part.partNumber)));
        const size = buffers.reduce((sum, bytes) => sum + bytes.byteLength, 0);
        const merged = new Uint8Array(size);
        let offset = 0;
        for (const bytes of buffers) { merged.set(bytes, offset); offset += bytes.byteLength; }
        store.objects.set(key, { body: merged.buffer, options: upload.options });
        store.uploads.delete(uploadId);
        return { size };
      },
      async abort() { store.uploads.delete(uploadId); }
    };
  }
  async delete(key) { this.objects.delete(key); }
}

function bindings() {
  return {
    DB: new MockD1(),
    MEDIA: new MockR2(),
    STUDIO_ADMIN_PASSWORD: PASSWORD,
    SESSION_SECRET,
    STUDIO_ENVIRONMENT: 'test'
  };
}

function request(path, { method = 'GET', body, cookie, type = 'application/json', origin = ORIGIN, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (origin !== null) requestHeaders.set('Origin', origin);
  if (cookie) requestHeaders.set('Cookie', cookie);
  if (body !== undefined && type) requestHeaders.set('Content-Type', type);
  return new Request(`${ORIGIN}${path}`, { method, headers: requestHeaders, body });
}

async function login(env) {
  const response = await worker.fetch(request('/api/login', {
    method: 'POST', body: JSON.stringify({ password: PASSWORD })
  }), env);
  assert.equal(response.status, 200);
  return response.headers.get('Set-Cookie').split(';')[0];
}

async function createFilm(env, cookie) {
  const response = await worker.fetch(request('/api/films', {
    method: 'POST', cookie, body: JSON.stringify({ title: 'Test Film', description: 'Isolated preview.' })
  }), env);
  assert.equal(response.status, 201);
  return response.json();
}

function studioDom() {
  const selectors = [
    '#title', '#description', '#video', '#poster', '#video-status', '#poster-status', '#notice',
    '#preview-video', '#preview-title', '#preview-description', '#preview-state', '#save', '#publish',
    '#unpublish', '#open-preview', '#film-list', '#new-draft', '#logout', '#release-request',
    '#release-output', '#release-slug', '#release-date', '#duration', '#duration-label', '#video-reference',
    '#poster-reference', '#video-sha', '#poster-sha', '#homepage-feature'
  ];
  return new Map(selectors.map(selector => [selector, {
    value: '', checked: false, textContent: '', className: '', innerHTML: '', poster: '', src: '', href: '',
    hidden: false, disabled: false, listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; }
  }]));
}

test('constant-time comparison and file signatures validate expected inputs', () => {
  assert.equal(timingSafeEqual('same', 'same'), true);
  assert.equal(timingSafeEqual('same', 'different'), false);
  assert.equal(validMagic('video', 'video/mp4', Uint8Array.from([0, 0, 0, 16, 102, 116, 121, 112])), true);
  assert.equal(validMagic('poster', 'image/png', Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
  assert.equal(validMagic('poster', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff])), true);
  assert.equal(validMagic('video', 'video/mp4', Uint8Array.from([0, 0, 0, 0, 98, 97, 100, 33])), false);
});

test('all Studio and preview routes require a server-authorized session', async () => {
  const env = bindings();
  const page = await worker.fetch(request('/', { origin: null }), env);
  assert.equal(page.status, 303);
  assert.equal(new URL(page.headers.get('Location')).pathname, '/login');
  const api = await worker.fetch(request('/api/films', { origin: null }), env);
  assert.equal(api.status, 401);
  const preview = await worker.fetch(request(`/preview/${crypto.randomUUID()}`, { origin: null }), env);
  assert.equal(preview.status, 303);
});

test('login rejects bad credentials, cross-origin requests, and weak configuration', async () => {
  const env = bindings();
  const bad = await worker.fetch(request('/api/login', {
    method: 'POST', body: JSON.stringify({ password: 'wrong-password' })
  }), env);
  assert.equal(bad.status, 401);
  const crossOrigin = await worker.fetch(request('/api/login', {
    method: 'POST', origin: 'https://attacker.example', body: JSON.stringify({ password: PASSWORD })
  }), env);
  assert.equal(crossOrigin.status, 403);
  const weak = await worker.fetch(request('/login', { origin: null }), { ...env, SESSION_SECRET: 'short' });
  assert.equal(weak.status, 503);
});

test('draft metadata can be created, edited, and listed', async () => {
  const env = bindings();
  const cookie = await login(env);
  const film = await createFilm(env, cookie);
  assert.match(film.slug, /^test-film-/);
  assert.equal(film.status, 'draft');

  const updated = await worker.fetch(request(`/api/films/${film.id}`, {
    method: 'PATCH', cookie, body: JSON.stringify({ title: 'Revised Film', description: 'Updated.' })
  }), env);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).title, 'Revised Film');

  const list = await worker.fetch(request('/api/films', { cookie, origin: null }), env);
  assert.equal(list.status, 200);
  assert.equal((await list.json()).films.length, 1);
});

test('film title remains editable while the draft list refreshes', async () => {
  const elements = studioDom();
  let releaseList;
  const listReady = new Promise(resolve => { releaseList = resolve; });
  const context = {
    document: { querySelector: selector => elements.get(selector) },
    fetch: async path => {
      assert.equal(path, '/api/films');
      await listReady;
      return { status: 200, ok: true, json: async () => ({ films: [] }) };
    },
    URL: { createObjectURL: () => 'blob:test' },
    location: { href: '' }
  };
  vm.runInNewContext(appScript, context);
  elements.get('#title').value = 'Owner title in progress';
  elements.get('#description').value = 'Owner description in progress';
  releaseList();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('#title').value, 'Owner title in progress');
  assert.equal(elements.get('#description').value, 'Owner description in progress');
  assert.match(studioPage('test'), /large MP4s use resumable parts/i);
});

test('large videos enter authenticated multipart upload without exposing storage credentials', async () => {
  const env = bindings();
  const cookie = await login(env);
  const film = await createFilm(env, cookie);
  const maxVideoBytes = studioLimits().maxVideoBytes;
  const response = await worker.fetch(request(`/api/films/${film.id}/video/multipart`, {
    method: 'POST', cookie,
    body: JSON.stringify({ fileName: 'large-master.mp4', contentType: 'video/mp4', bytes: maxVideoBytes + 1 })
  }), env);
  assert.equal(response.status, 201);
  const session = await response.json();
  assert.match(session.uploadId, /^upload-/);
  assert.equal(session.expectedBytes, maxVideoBytes + 1);
  assert.equal(JSON.stringify(session).includes('credential'), false);

  const tooSmallPart = await worker.fetch(request(`/api/films/${film.id}/video/multipart/${session.uploadId}/1`, {
    method: 'PUT', cookie, type: 'video/mp4', body: Uint8Array.from([0, 0, 0, 16, 102, 116, 121, 112]),
    headers: { 'Content-Length': '8' }
  }), env);
  assert.equal(tooSmallPart.status, 400);
});

test('release request produces an immutable owner-gated manifest entry', async () => {
  const env = bindings();
  const cookie = await login(env);
  const film = await createFilm(env, cookie);
  const mp4 = Uint8Array.from([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0]);
  await worker.fetch(request(`/api/films/${film.id}/video`, { method: 'PUT', cookie, body: mp4, type: 'video/mp4', headers: { 'Content-Length': String(mp4.byteLength), 'X-File-Name': 'film.mp4' } }), env);
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await worker.fetch(request(`/api/films/${film.id}/poster`, { method: 'PUT', cookie, body: png, type: 'image/png', headers: { 'Content-Length': String(png.byteLength), 'X-File-Name': 'poster.png' } }), env);
  const hash = 'a'.repeat(64);
  const response = await worker.fetch(request(`/api/films/${film.id}/release-request`, {
    method: 'POST', cookie,
    body: JSON.stringify({
      slug: 'test-film', releaseDate: '2026-11-15', duration: 'PT1M', durationLabel: '1 minute',
      videoReference: 'assets/originals/test-film/film.mp4', posterReference: 'assets/originals/test-film/poster.png',
      videoSha256: hash, posterSha256: hash, homepageFeatured: true
    })
  }), env);
  assert.equal(response.status, 201);
  const approval = await response.json();
  assert.equal(approval.plan.status, 'prepared');
  assert.equal(approval.plan.ownerAuthorization, 'required');
  assert.equal(approval.plan.film.placements.homepage, true);
  assert.equal(approval.plan.film.video.path, 'assets/originals/test-film/film.mp4');
  assert.ok(approval.digest.length > 20);
  assert.equal(env.DB.releaseRequests.size, 1);
});

test('publish requires both validated private assets and supports unpublish', async () => {
  const env = bindings();
  const cookie = await login(env);
  const film = await createFilm(env, cookie);
  const premature = await worker.fetch(request(`/api/films/${film.id}/publish`, { method: 'POST', cookie }), env);
  assert.equal(premature.status, 409);

  const mp4 = Uint8Array.from([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0]);
  const video = await worker.fetch(request(`/api/films/${film.id}/video`, {
    method: 'PUT', cookie, body: mp4, type: 'video/mp4',
    headers: { 'Content-Length': String(mp4.byteLength), 'X-File-Name': 'film.mp4' }
  }), env);
  assert.equal(video.status, 200);

  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const poster = await worker.fetch(request(`/api/films/${film.id}/poster`, {
    method: 'PUT', cookie, body: png, type: 'image/png',
    headers: { 'Content-Length': String(png.byteLength), 'X-File-Name': 'poster.png' }
  }), env);
  assert.equal(poster.status, 200);

  const published = await worker.fetch(request(`/api/films/${film.id}/publish`, { method: 'POST', cookie }), env);
  assert.equal(published.status, 200);
  assert.equal((await published.json()).status, 'published');

  const asset = await worker.fetch(request(`/api/films/${film.id}/video`, { cookie, origin: null }), env);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(asset.headers.get('Content-Type'), 'video/mp4');

  const unpublished = await worker.fetch(request(`/api/films/${film.id}/unpublish`, { method: 'POST', cookie }), env);
  assert.equal(unpublished.status, 200);
  assert.equal((await unpublished.json()).status, 'draft');
});

test('unsafe files, oversized uploads, and cross-origin mutations are rejected', async () => {
  const env = bindings();
  const cookie = await login(env);
  const film = await createFilm(env, cookie);
  const invalid = Uint8Array.from([0, 0, 0, 16, 98, 97, 100, 33]);
  const badFile = await worker.fetch(request(`/api/films/${film.id}/video`, {
    method: 'PUT', cookie, body: invalid, type: 'video/mp4',
    headers: { 'Content-Length': String(invalid.byteLength), 'X-File-Name': 'bad.mp4' }
  }), env);
  assert.equal(badFile.status, 415);
  const oversized = await worker.fetch(request(`/api/films/${film.id}/poster`, {
    method: 'PUT', cookie, body: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), type: 'image/png',
    headers: { 'Content-Length': String(6 * 1024 * 1024), 'X-File-Name': 'huge.png' }
  }), env);
  assert.equal(oversized.status, 413);
  const crossOrigin = await worker.fetch(request(`/api/films/${film.id}/publish`, {
    method: 'POST', cookie, origin: 'https://attacker.example'
  }), env);
  assert.equal(crossOrigin.status, 403);
});

test('rendered pages carry noindex and restrictive browser security headers', async () => {
  const env = bindings();
  const loginPage = await worker.fetch(request('/login', { origin: null }), env);
  assert.equal(loginPage.status, 200);
  assert.match(loginPage.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(loginPage.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  const body = await loginPage.text();
  assert.match(body, /Protected test environment/);
});
