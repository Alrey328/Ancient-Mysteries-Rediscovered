import { loginPage, previewPage, studioPage } from './ui.js';

const SESSION_SECONDS = 8 * 60 * 60;
const MAX_JSON_BYTES = 12_000;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_POSTER_BYTES = 5 * 1024 * 1024;
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
  await env.MEDIA.put(key, stream, { httpMetadata: { contentType: mime }, customMetadata: { filmId: film.id, environment: 'test' } });
  const name = cleanText(request.headers.get('X-File-Name') || `${kind}.${extension}`, 'File name', 180, true);
  const now = new Date().toISOString();
  const prefix = kind === 'video' ? 'video' : 'poster';
  await env.DB.prepare(`UPDATE studio_films SET ${prefix}_key = ?, ${prefix}_name = ?, ${prefix}_bytes = ?, updated_at = ? WHERE id = ?`)
    .bind(key, name, bytes, now, film.id).run();
  return json(filmJson(await getFilm(env.DB, id)));
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

export { handleRequest, timingSafeEqual, validMagic };

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
