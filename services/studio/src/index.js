import { loginPage, previewPage, studioPage } from './ui.js';

const SESSION_SECONDS = 8 * 60 * 60;
const MAX_JSON_BYTES = 12_000;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_POSTER_BYTES = 5 * 1024 * 1024;
const MULTIPART_PART_BYTES = 25 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 10_000;
const MAX_MULTIPART_VIDEO_BYTES = MULTIPART_PART_BYTES * MAX_MULTIPART_PARTS;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_LIMIT = 10;
const COOKIE = 'amr_studio_session';
let localSchemaReady;

const LOCAL_SCHEMA = [
`CREATE TABLE IF NOT EXISTS studio_films (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  video_key TEXT, video_name TEXT, video_bytes INTEGER,
  poster_key TEXT, poster_name TEXT, poster_bytes INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
)`,
`CREATE INDEX IF NOT EXISTS studio_films_updated_at ON studio_films(updated_at DESC)`,
`CREATE TABLE IF NOT EXISTS studio_login_attempts (
  ip_hash TEXT NOT NULL, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
)`,
`CREATE TABLE IF NOT EXISTS studio_multipart_uploads (
  film_id TEXT NOT NULL, kind TEXT NOT NULL, upload_id TEXT NOT NULL,
  object_key TEXT NOT NULL, file_name TEXT NOT NULL, content_type TEXT NOT NULL,
  expected_bytes INTEGER NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (film_id, kind)
)`,
`CREATE TABLE IF NOT EXISTS studio_release_requests (
  film_id TEXT PRIMARY KEY, request_json TEXT NOT NULL, request_digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'owner_approval_required',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
)`
];

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    }
  });
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hmac(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function timingSafeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) mismatch |= (a[index] || 0) ^ (b[index] || 0);
  return mismatch === 0;
}

async function makeSession(secret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${expires}.${await hmac(secret, `session:${expires}`)}`;
}

async function sessionValid(request, env) {
  if (typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) return false;
  const cookie = request.headers.get('Cookie') || '';
  const value = cookie.split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [expiresText, signature] = value.split('.');
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000) || !signature) return false;
  return timingSafeEqual(signature, await hmac(env.SESSION_SECRET, `session:${expires}`));
}

function assertConfigured(env) {
  if (!env.DB || !env.MEDIA || typeof env.STUDIO_ADMIN_PASSWORD !== 'string' || env.STUDIO_ADMIN_PASSWORD.length < 12 || typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) {
    throw new HttpError(503, 'Studio is not configured');
  }
}

async function ensureLocalSchema(env) {
  if (env.STUDIO_AUTO_MIGRATE !== 'true') return;
  localSchemaReady ||= env.DB.batch(LOCAL_SCHEMA.map(statement => env.DB.prepare(statement))).catch(error => {
    localSchemaReady = undefined;
    throw error;
  });
  await localSchemaReady;
}

function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) throw new HttpError(403, 'Origin denied');
}

async function readJson(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Expected JSON');
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_JSON_BYTES) throw new HttpError(413, 'Payload too large');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) throw new HttpError(413, 'Payload too large');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

function cleanText(value, name, max, required = false) {
  if (typeof value !== 'string') throw new HttpError(400, `${name} must be text`);
  const clean = value.trim();
  if (required && !clean) throw new HttpError(400, `${name} is required`);
  if (clean.length > max) throw new HttpError(400, `${name} is too long`);
  return clean;
}

function slugify(title, id) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'film';
  return `${base}-${id.slice(0, 6)}`;
}

function releaseSlug(value) {
  const slug = cleanText(value, 'Release slug', 80, true).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, 'Release slug must use lowercase letters, numbers, and hyphens');
  return slug;
}

function productionAsset(value, kind, bytes, sha256) {
  const reference = cleanText(value, `${kind} production reference`, 500, true);
  const digest = cleanText(sha256, `${kind} SHA-256`, 64, true).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new HttpError(400, `${kind} SHA-256 must be 64 hexadecimal characters`);
  if (!Number.isInteger(bytes) || bytes < 8) throw new HttpError(400, `${kind} byte count is invalid`);
  if (/^https:\/\//.test(reference)) return { source: 'external', url: reference, contentType: kind === 'video' ? 'video/mp4' : undefined, bytes, sha256: digest };
  if (reference.startsWith('/') || reference.includes('\\') || reference.split('/').includes('..')) throw new HttpError(400, `${kind} repository path is unsafe`);
  if (kind === 'video' && !reference.toLowerCase().endsWith('.mp4')) throw new HttpError(400, 'Video repository path must end in .mp4');
  if (kind === 'poster' && !/\.(?:jpe?g|png|webp)$/i.test(reference)) throw new HttpError(400, 'Poster repository path must identify a JPEG, PNG, or WebP');
  return { source: 'repository', path: reference, contentType: kind === 'video' ? 'video/mp4' : `image/${reference.toLowerCase().endsWith('.png') ? 'png' : reference.toLowerCase().endsWith('.webp') ? 'webp' : 'jpeg'}`, bytes, sha256: digest };
}

function filmJson(row) {
  return {
    ...row,
    video_url: row.video_key ? `/api/films/${row.id}/video` : null,
    poster_url: row.poster_key ? `/api/films/${row.id}/poster` : null
  };
}

async function getFilm(db, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Film not found');
  const row = await db.prepare('SELECT * FROM studio_films WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'Film not found');
  return row;
}

async function throttleLogin(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const ipHash = await hmac(env.SESSION_SECRET, `login:${ip}`);
  const windowStart = Math.floor(Date.now() / 1000 / LOGIN_WINDOW_SECONDS);
  const row = await env.DB.prepare(`
    INSERT INTO studio_login_attempts (ip_hash, window_start, attempts) VALUES (?, ?, 1)
    ON CONFLICT(ip_hash, window_start) DO UPDATE SET attempts = studio_login_attempts.attempts + 1
    RETURNING attempts
  `).bind(ipHash, windowStart).first();
  if (Number(row?.attempts || LOGIN_LIMIT + 1) > LOGIN_LIMIT) throw new HttpError(429, 'Too many sign-in attempts', { 'Retry-After': String(LOGIN_WINDOW_SECONDS) });
}

async function handleLogin(request, env) {
  assertSameOrigin(request);
  await throttleLogin(request, env);
  const body = await readJson(request);
  if (!timingSafeEqual(body.password, env.STUDIO_ADMIN_PASSWORD)) throw new HttpError(401, 'Invalid passphrase');
  const session = await makeSession(env.SESSION_SECRET);
  return json({ ok: true }, 200, {
    'Set-Cookie': `${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
  });
}

async function listFilms(env) {
  const result = await env.DB.prepare('SELECT * FROM studio_films ORDER BY updated_at DESC LIMIT 50').all();
  return json({ films: (result.results || []).map(filmJson) });
}

async function createFilm(request, env) {
  const body = await readJson(request);
  const title = cleanText(body.title, 'Title', 120, true);
  const description = cleanText(body.description ?? '', 'Description', 1000);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO studio_films (id, slug, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, slugify(title, id), title, description, now, now).run();
  return json(filmJson(await getFilm(env.DB, id)), 201);
}

async function updateFilm(request, env, id) {
  const film = await getFilm(env.DB, id);
  const body = await readJson(request);
  const title = cleanText(body.title, 'Title', 120, true);
  const description = cleanText(body.description ?? '', 'Description', 1000);
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE studio_films SET title = ?, description = ?, slug = ?, updated_at = ? WHERE id = ?')
    .bind(title, description, slugify(title, id), now, film.id).run();
  return json(filmJson(await getFilm(env.DB, id)));
}

function validMagic(kind, mime, bytes) {
  if (kind === 'video') return mime === 'video/mp4' && bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
  if (mime === 'image/png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

async function uploadAsset(request, env, id, kind) {
  const film = await getFilm(env.DB, id);
  const mime = (request.headers.get('Content-Type') || '').toLowerCase().split(';')[0];
  const bytes = Number(request.headers.get('Content-Length'));
  const maximum = kind === 'video' ? MAX_VIDEO_BYTES : MAX_POSTER_BYTES;
  if (!Number.isInteger(bytes) || bytes < 8 || bytes > maximum) throw new HttpError(413, `${kind === 'video' ? 'Video' : 'Poster'} must be between 8 bytes and ${maximum / 1024 / 1024} MB`);
  if (!request.body) throw new HttpError(400, 'Missing file');
  const reader = request.body.getReader();
  const first = await reader.read();
  if (first.done || !validMagic(kind, mime, first.value.slice(0, 16))) {
    await reader.cancel();
    throw new HttpError(415, kind === 'video' ? 'File is not a valid MP4' : 'File is not a valid JPEG, PNG or WebP image');
  }
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(first.value);
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) return controller.close();
        controller.enqueue(value);
        return pump();
      }).catch(error => controller.error(error));
      return pump();
    },
    cancel(reason) { return reader.cancel(reason); }
  });
  const extension = kind === 'video' ? 'mp4' : ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[mime];
  const key = `drafts/${film.id}/${kind}.${extension}`;
  const fixed = typeof FixedLengthStream === 'function' ? new FixedLengthStream(bytes) : null;
  const body = fixed ? fixed.readable : stream;
  const write = fixed ? stream.pipeTo(fixed.writable) : Promise.resolve();
  await Promise.all([
    env.MEDIA.put(key, body, { httpMetadata: { contentType: mime }, customMetadata: { filmId: film.id, environment: 'test' } }),
    write
  ]);
  const name = cleanText(request.headers.get('X-File-Name') || `${kind}.${extension}`, 'File name', 180, true);
  const now = new Date().toISOString();
  const prefix = kind === 'video' ? 'video' : 'poster';
  await env.DB.prepare(`UPDATE studio_films SET ${prefix}_key = ?, ${prefix}_name = ?, ${prefix}_bytes = ?, updated_at = ? WHERE id = ?`)
    .bind(key, name, bytes, now, film.id).run();
  return json(filmJson(await getFilm(env.DB, id)));
}

async function createMultipartUpload(request, env, id) {
  const film = await getFilm(env.DB, id);
  const body = await readJson(request);
  const bytes = Number(body.bytes);
  if (!Number.isInteger(bytes) || bytes <= MAX_VIDEO_BYTES || bytes > MAX_MULTIPART_VIDEO_BYTES) {
    throw new HttpError(413, `Multipart video must be larger than ${MAX_VIDEO_BYTES / 1024 / 1024} MB and no larger than ${MAX_MULTIPART_VIDEO_BYTES / 1024 / 1024} MB`);
  }
  if (body.contentType !== 'video/mp4') throw new HttpError(415, 'Multipart video must be an MP4');
  const fileName = cleanText(body.fileName, 'File name', 180, true);
  const key = `drafts/${film.id}/video.mp4`;
  const upload = await env.MEDIA.createMultipartUpload(key, {
    httpMetadata: { contentType: 'video/mp4' },
    customMetadata: { filmId: film.id, environment: 'test' }
  });
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO studio_multipart_uploads
    (film_id, kind, upload_id, object_key, file_name, content_type, expected_bytes, created_at)
    VALUES (?, 'video', ?, ?, ?, 'video/mp4', ?, ?)
    ON CONFLICT(film_id, kind) DO UPDATE SET upload_id=excluded.upload_id, object_key=excluded.object_key,
      file_name=excluded.file_name, content_type=excluded.content_type, expected_bytes=excluded.expected_bytes, created_at=excluded.created_at`)
    .bind(film.id, upload.uploadId, key, fileName, bytes, now).run();
  return json({ uploadId: upload.uploadId, partSize: MULTIPART_PART_BYTES, expectedBytes: bytes }, 201);
}

async function getMultipartSession(env, id, uploadId) {
  await getFilm(env.DB, id);
  const row = await env.DB.prepare(`SELECT * FROM studio_multipart_uploads WHERE film_id = ? AND kind = 'video'`).bind(id).first();
  if (!row || !timingSafeEqual(row.upload_id, uploadId)) throw new HttpError(404, 'Multipart upload not found');
  return row;
}

async function uploadMultipartPart(request, env, id, uploadId, partNumber) {
  const session = await getMultipartSession(env, id, uploadId);
  const bytes = Number(request.headers.get('Content-Length'));
  const minimum = 5 * 1024 * 1024;
  const maximum = 95 * 1024 * 1024;
  if (!Number.isInteger(bytes) || bytes < 1 || bytes > maximum) throw new HttpError(413, 'Multipart part must be between 1 byte and 95 MB');
  const expectedParts = Math.ceil(Number(session.expected_bytes) / MULTIPART_PART_BYTES);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > expectedParts) throw new HttpError(400, 'Invalid multipart part number');
  if (partNumber < expectedParts && bytes < minimum) throw new HttpError(400, 'Every non-final multipart part must be at least 5 MB');
  if (!request.body) throw new HttpError(400, 'Missing multipart part');
  let stream = request.body;
  if (partNumber === 1) {
    const reader = stream.getReader();
    const first = await reader.read();
    if (first.done || !validMagic('video', 'video/mp4', first.value.slice(0, 16))) {
      await reader.cancel();
      throw new HttpError(415, 'File is not a valid MP4');
    }
    stream = new ReadableStream({
      start(controller) {
        controller.enqueue(first.value);
        const pump = () => reader.read().then(({ done, value }) => {
          if (done) return controller.close();
          controller.enqueue(value);
          return pump();
        }).catch(error => controller.error(error));
        return pump();
      },
      cancel(reason) { return reader.cancel(reason); }
    });
  }
  const fixed = typeof FixedLengthStream === 'function' ? new FixedLengthStream(bytes) : null;
  const uploadBody = fixed ? fixed.readable : stream;
  const write = fixed ? stream.pipeTo(fixed.writable) : Promise.resolve();
  const multipart = env.MEDIA.resumeMultipartUpload(session.object_key, session.upload_id);
  const [part] = await Promise.all([multipart.uploadPart(partNumber, uploadBody), write]);
  return json(part);
}

async function completeMultipartUpload(request, env, id, uploadId) {
  const session = await getMultipartSession(env, id, uploadId);
  const body = await readJson(request);
  if (!Array.isArray(body.parts) || body.parts.length < 2 || body.parts.length > MAX_MULTIPART_PARTS) throw new HttpError(400, 'Multipart completion requires uploaded parts');
  const parts = body.parts.map(part => ({ partNumber: Number(part.partNumber), etag: cleanText(part.etag, 'Part ETag', 200, true) }));
  const numbers = new Set(parts.map(part => part.partNumber));
  if (numbers.size !== parts.length || parts.some(part => !Number.isInteger(part.partNumber) || part.partNumber < 1)) throw new HttpError(400, 'Multipart parts are invalid');
  const multipart = env.MEDIA.resumeMultipartUpload(session.object_key, session.upload_id);
  const object = await multipart.complete(parts.sort((left, right) => left.partNumber - right.partNumber));
  if (Number(object.size) !== Number(session.expected_bytes)) {
    await env.MEDIA.delete(session.object_key);
    throw new HttpError(409, 'Completed video size does not match the selected file');
  }
  const head = await env.MEDIA.get(session.object_key, { range: { offset: 0, length: 16 } });
  const magic = head ? new Uint8Array(await new Response(head.body).arrayBuffer()) : new Uint8Array();
  if (!validMagic('video', 'video/mp4', magic)) {
    await env.MEDIA.delete(session.object_key);
    throw new HttpError(415, 'Completed file is not a valid MP4');
  }
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE studio_films SET video_key = ?, video_name = ?, video_bytes = ?, updated_at = ? WHERE id = ?')
    .bind(session.object_key, session.file_name, Number(session.expected_bytes), now, id).run();
  await env.DB.prepare(`DELETE FROM studio_multipart_uploads WHERE film_id = ? AND kind = 'video'`).bind(id).run();
  return json(filmJson(await getFilm(env.DB, id)));
}

async function abortMultipartUpload(env, id, uploadId) {
  const session = await getMultipartSession(env, id, uploadId);
  await env.MEDIA.resumeMultipartUpload(session.object_key, session.upload_id).abort();
  await env.DB.prepare(`DELETE FROM studio_multipart_uploads WHERE film_id = ? AND kind = 'video'`).bind(id).run();
  return new Response(null, { status: 204 });
}

async function createReleaseRequest(request, env, id) {
  const film = await getFilm(env.DB, id);
  if (!film.video_key || !film.poster_key) throw new HttpError(409, 'Upload both the MP4 and poster before requesting owner approval');
  const body = await readJson(request);
  const slug = releaseSlug(body.slug);
  const releaseDate = cleanText(body.releaseDate, 'Release date', 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) throw new HttpError(400, 'Release date must use YYYY-MM-DD');
  const duration = cleanText(body.duration, 'ISO duration', 32, true);
  if (!/^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(duration)) throw new HttpError(400, 'Duration must be an ISO 8601 duration');
  const durationLabel = cleanText(body.durationLabel, 'Duration label', 40, true);
  const requestPlan = {
    schemaVersion: 1,
    status: 'prepared',
    ownerAuthorization: 'required',
    requestedAt: new Date().toISOString(),
    film: {
      slug,
      title: film.title,
      description: film.description,
      about: cleanText(body.about ?? film.description, 'About', 2000, true),
      releaseDate,
      duration,
      durationLabel,
      status: 'prepared',
      placements: { cinema: true, exclusives: true, homepage: body.homepageFeatured === true },
      video: productionAsset(body.videoReference, 'video', Number(body.videoBytes ?? film.video_bytes), body.videoSha256),
      poster: productionAsset(body.posterReference, 'poster', Number(body.posterBytes ?? film.poster_bytes), body.posterSha256),
      discussionTerm: `cinema-${slug}`,
      engagement: { enabled: body.engagementEnabled === true, id: slug }
    }
  };
  const encoded = JSON.stringify(requestPlan);
  const digest = base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encoded)));
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO studio_release_requests
    (film_id, request_json, request_digest, status, created_at, updated_at)
    VALUES (?, ?, ?, 'owner_approval_required', ?, ?)
    ON CONFLICT(film_id) DO UPDATE SET request_json=excluded.request_json, request_digest=excluded.request_digest,
      status='owner_approval_required', updated_at=excluded.updated_at`)
    .bind(id, encoded, digest, now, now).run();
  return json({ digest, plan: requestPlan, nextStep: 'Open a focused draft pull request containing this prepared manifest entry. Production publishing requires the owner to approve and merge that pull request.' }, 201);
}

async function streamAsset(request, env, id, kind) {
  const film = await getFilm(env.DB, id);
  const key = film[`${kind}_key`];
  if (!key) throw new HttpError(404, 'Asset not found');
  const object = await env.MEDIA.get(key, request.headers.has('Range') ? { range: request.headers } : undefined);
  if (!object) throw new HttpError(404, 'Asset not found');
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' });
  object.writeHttpMetadata?.(headers);
  if (object.range && object.size) {
    const offset = object.range.offset || 0;
    const length = object.range.length || object.size;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
  }
  return new Response(object.body, { status: object.range ? 206 : 200, headers });
}

async function setPublished(env, id, published) {
  const film = await getFilm(env.DB, id);
  if (published && (!film.video_key || !film.poster_key)) throw new HttpError(409, 'Upload both the MP4 and poster before publishing');
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE studio_films SET status = ?, published_at = ?, updated_at = ? WHERE id = ?')
    .bind(published ? 'published' : 'draft', published ? now : null, now, id).run();
  return json(filmJson(await getFilm(env.DB, id)));
}

async function handleAuthenticated(request, env, url) {
  if (request.method !== 'GET') assertSameOrigin(request);
  if (url.pathname === '/' && request.method === 'GET') return html(studioPage(env.STUDIO_ENVIRONMENT || 'test'));
  if (url.pathname === '/api/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  if (url.pathname === '/api/films' && request.method === 'GET') return listFilms(env);
  if (url.pathname === '/api/films' && request.method === 'POST') return createFilm(request, env);
  const multipartMatch = url.pathname.match(/^\/api\/films\/([0-9a-f-]{36})\/video\/multipart(?:\/([A-Za-z0-9_-]+)(?:\/(\d+))?)?\/?$/i);
  if (multipartMatch) {
    const [, id, uploadId, partText] = multipartMatch;
    if (!uploadId && request.method === 'POST') return createMultipartUpload(request, env, id);
    if (uploadId && partText && request.method === 'PUT') return uploadMultipartPart(request, env, id, uploadId, Number(partText));
    if (uploadId && !partText && request.method === 'POST') return completeMultipartUpload(request, env, id, uploadId);
    if (uploadId && !partText && request.method === 'DELETE') return abortMultipartUpload(env, id, uploadId);
    throw new HttpError(405, 'Method not allowed');
  }
  const releaseMatch = url.pathname.match(/^\/api\/films\/([0-9a-f-]{36})\/release-request\/?$/i);
  if (releaseMatch && request.method === 'POST') return createReleaseRequest(request, env, releaseMatch[1]);
  const match = url.pathname.match(/^\/api\/films\/([0-9a-f-]{36})(?:\/(video|poster|publish|unpublish))?\/?$/i);
  if (match) {
    const [, id, action] = match;
    if (!action && request.method === 'GET') return json(filmJson(await getFilm(env.DB, id)));
    if (!action && request.method === 'PATCH') return updateFilm(request, env, id);
    if ((action === 'video' || action === 'poster') && request.method === 'PUT') return uploadAsset(request, env, id, action);
    if ((action === 'video' || action === 'poster') && request.method === 'GET') return streamAsset(request, env, id, action);
    if (action === 'publish' && request.method === 'POST') return setPublished(env, id, true);
    if (action === 'unpublish' && request.method === 'POST') return setPublished(env, id, false);
    throw new HttpError(405, 'Method not allowed');
  }
  const previewMatch = url.pathname.match(/^\/preview\/([0-9a-f-]{36})\/?$/i);
  if (previewMatch && request.method === 'GET') return html(previewPage(await getFilm(env.DB, previewMatch[1])));
  throw new HttpError(404, 'Not found');
}

async function handleRequest(request, env) {
  assertConfigured(env);
  await ensureLocalSchema(env);
  const url = new URL(request.url);
  if (url.pathname === '/login' && request.method === 'GET') {
    if (await sessionValid(request, env)) return Response.redirect(`${url.origin}/`, 303);
    return html(loginPage());
  }
  if (url.pathname === '/api/login' && request.method === 'POST') return handleLogin(request, env);
  if (!(await sessionValid(request, env))) {
    if (url.pathname.startsWith('/api/')) return json({ error: 'Authentication required' }, 401);
    return Response.redirect(`${url.origin}/login`, 303);
  }
  return handleAuthenticated(request, env, url);
}

function studioLimits() {
  return { maxVideoBytes: MAX_VIDEO_BYTES, multipartPartBytes: MULTIPART_PART_BYTES };
}

export { handleRequest, timingSafeEqual, validMagic, studioLimits };

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, error.headers);
      console.error('Studio request failed', error);
      return json({ error: 'Studio temporarily unavailable' }, 503);
    }
  }
};
