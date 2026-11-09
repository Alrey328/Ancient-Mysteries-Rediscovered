// AMR Cinema engagement, membership, native comments, and release notifications.
// Existing anonymous counters remain supported for legacy AMR Exclusives pages.
const VIDEO_IDS = new Set(['enuk', 'laestrygonians']);
const PRODUCTION_ORIGINS = new Set([
  'https://ancientmysteriesrediscovered.com',
  'https://www.ancientmysteriesrediscovered.com'
]);
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const MAX_BODY_BYTES = 8192;
const RATE_WINDOW_MINUTES = 1;
const RATE_RETENTION_MINUTES = 2 * 24 * 60;
const COMMENT_LIMIT = 2000;
const CONSENT_VERSION = '2026-11-05-v1';

let googleKeyCache = { expiresAt: 0, keys: [] };

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function previewOrigins(env = {}) {
  return typeof env.PREVIEW_ORIGINS === 'string'
    ? env.PREVIEW_ORIGINS.split(',').map(value => value.trim()).filter(Boolean)
    : typeof env.PREVIEW_ORIGIN === 'string' && env.PREVIEW_ORIGIN
      ? [env.PREVIEW_ORIGIN]
      : [];
}

function originAllowed(origin, env = {}) {
  return PRODUCTION_ORIGINS.has(origin) || previewOrigins(env).includes(origin);
}

function corsHeaders(origin, env) {
  if (!originAllowed(origin, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-AMR-Request',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status = 200, origin = '', extraHeaders = {}, env = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(origin, env),
      ...extraHeaders
    }
  });
}

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}

function validVisitor(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{2,79}$/.test(value);
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function decodeJsonPart(value) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch {
    throw new HttpError(401, 'Invalid identity token');
  }
}

async function digest(secret, namespace, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${namespace}:${value}`));
  return bytesToHex(new Uint8Array(signature));
}

function randomToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function readJson(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Expected JSON');
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new HttpError(413, 'Payload too large');
  if (!request.body) throw new HttpError(400, 'Invalid JSON');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, 'Payload too large');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

function requireBrowserMutation(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin, env)) throw new HttpError(403, 'Origin denied');
  if (request.headers.get('X-AMR-Request') !== '1') throw new HttpError(403, 'Request denied');
  return origin;
}

function requireMembershipConfig(env) {
  if (typeof env.SESSION_HMAC_SECRET !== 'string' || env.SESSION_HMAC_SECRET.length < 32
    || typeof env.IDENTITY_HMAC_SECRET !== 'string' || env.IDENTITY_HMAC_SECRET.length < 32) {
    throw new HttpError(503, 'Membership is not configured');
  }
}

async function totals(db, videoId) {
  const row = await db.prepare('SELECT likes, views FROM engagement_totals WHERE video_id = ?').bind(videoId).first();
  if (!row) throw new Error('Missing engagement_totals row');
  return { likes: Number(row.likes), views: Number(row.views) };
}

async function rateLimit(db, key, action, limit) {
  const windowStart = Math.floor(Date.now() / (RATE_WINDOW_MINUTES * 60_000));
  const result = await db.prepare(`
    INSERT INTO rate_events (visitor_hash, action, window_start, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(visitor_hash, action, window_start) DO UPDATE SET count = rate_events.count + 1
    WHERE rate_events.count < ? RETURNING count
  `).bind(key, action, windowStart, limit).first();
  return { allowed: result !== null && Number(result?.count || 0) <= limit, windowStart };
}

async function cleanupRateEvents(db, windowStart) {
  await db.prepare('DELETE FROM rate_events WHERE window_start < ?')
    .bind(windowStart - RATE_RETENTION_MINUTES).run();
}

function maybeScheduleCleanup(ctx, db, windowStart) {
  if (crypto.getRandomValues(new Uint8Array(1))[0] !== 0) return;
  const cleanup = cleanupRateEvents(db, windowStart).catch(() => {});
  if (ctx?.waitUntil) ctx.waitUntil(cleanup);
}

async function enforceRateLimit(request, env, ctx, action, limit) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = await digest(env.VISITOR_HASH_SECRET, 'ip', ip);
  const rate = await rateLimit(env.DB, key, action, limit);
  maybeScheduleCleanup(ctx, env.DB, rate.windowStart);
  if (!rate.allowed) throw new HttpError(429, 'Rate limited', { 'Retry-After': '60' });
}

function parseCookie(request, name) {
  for (const item of (request.headers.get('Cookie') || '').split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return '';
}

function requestSessionToken(request, env) {
  const cookie = parseCookie(request, 'amr_session');
  if (cookie) return cookie;
  if (env.PREVIEW_MODE === 'true') {
    const authorization = request.headers.get('Authorization') || '';
    if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  }
  return '';
}

async function currentMember(request, env) {
  if (!env.DB || typeof env.SESSION_HMAC_SECRET !== 'string') return null;
  const token = requestSessionToken(request, env);
  if (!token) return null;
  const tokenHash = await digest(env.SESSION_HMAC_SECRET, 'session', token);
  const member = await env.DB.prepare(`
    SELECT m.id, m.email, m.display_name, m.avatar_url, m.role,
      p.cinema_releases, p.investigations, p.series_chapters, s.created_at AS session_created_at
    FROM member_sessions s JOIN members m ON m.id = s.member_id
    JOIN notification_preferences p ON p.member_id = m.id
    WHERE s.token_hash = ? AND s.expires_at > unixepoch()
  `).bind(tokenHash).first();
  return member ? { ...member, tokenHash } : null;
}

function memberPayload(member) {
  if (!member) return null;
  return {
    id: member.id, email: member.email, displayName: member.display_name,
    avatarUrl: member.avatar_url || null, role: member.role,
    preferences: {
      cinemaReleases: Boolean(member.cinema_releases), investigations: Boolean(member.investigations),
      seriesChapters: Boolean(member.series_chapters)
    }
  };
}

function sessionCookie(token, env, maxAge = SESSION_SECONDS) {
  const sameSite = env.SESSION_COOKIE_SAMESITE === 'None' ? 'None' : 'Lax';
  return `amr_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=${sameSite}`;
}

async function getGoogleKeys() {
  if (googleKeyCache.expiresAt > Date.now() && googleKeyCache.keys.length) return googleKeyCache.keys;
  const response = await fetch(GOOGLE_JWKS_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new HttpError(503, 'Identity verification unavailable');
  const data = await response.json();
  const maxAge = Number((response.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 300);
  googleKeyCache = { keys: Array.isArray(data.keys) ? data.keys : [], expiresAt: Date.now() + maxAge * 1000 };
  return googleKeyCache.keys;
}

async function verifyGoogleCredential(credential, nonce, env) {
  if (typeof env.GOOGLE_CLIENT_ID !== 'string' || !env.GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google sign-in is not configured');
  if (typeof credential !== 'string' || credential.length > 5000) throw new HttpError(401, 'Invalid identity token');
  const parts = credential.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Invalid identity token');
  const header = decodeJsonPart(parts[0]);
  const payload = decodeJsonPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new HttpError(401, 'Invalid identity token');
  const jwk = (await getGoogleKeys()).find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new HttpError(401, 'Identity key unavailable');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!valid || !GOOGLE_ISSUERS.has(payload.iss) || !audiences.includes(env.GOOGLE_CLIENT_ID)
    || (audiences.length > 1 && payload.azp !== env.GOOGLE_CLIENT_ID)
    || !Number.isInteger(payload.exp) || payload.exp <= now
    || !Number.isInteger(payload.iat) || payload.iat > now + 60
    || payload.email_verified !== true || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new HttpError(401, 'Invalid identity token');
  }
  if (typeof nonce !== 'string' || nonce.length < 16 || payload.nonce !== nonce) throw new HttpError(401, 'Invalid sign-in nonce');
  return payload;
}

function cleanDisplayName(value) {
  const normalized = String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (normalized.length < 1 || normalized.length > 50) throw new HttpError(400, 'Display name must be 1–50 characters');
  return normalized;
}

function safeAvatar(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.googleusercontent.com') ? url.href : null;
  } catch { return null; }
}

async function claimLegacyLikes(db, memberId, visitorHash) {
  if (!visitorHash) return;
  const statements = [];
  for (const videoId of VIDEO_IDS) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO member_likes (video_id, member_id)
      SELECT ?, ? WHERE EXISTS (SELECT 1 FROM likes WHERE video_id = ? AND visitor_hash = ?)
    `).bind(videoId, memberId, videoId, visitorHash));
    statements.push(db.prepare('DELETE FROM likes WHERE video_id = ? AND visitor_hash = ?').bind(videoId, visitorHash));
  }
  await db.batch(statements);
}

async function handleGoogleSignIn(request, env) {
  requireBrowserMutation(request, env);
  requireMembershipConfig(env);
  const body = await readJson(request);
  const identity = await verifyGoogleCredential(body.credential, body.nonce, env);
  const subjectHash = await digest(env.IDENTITY_HMAC_SECRET, 'google-sub', identity.sub);
  const email = identity.email.trim();
  const emailNormalized = email.toLowerCase();
  const displayName = cleanDisplayName(identity.name || email.split('@')[0]);
  const avatar = safeAvatar(identity.picture);
  let member = await env.DB.prepare('SELECT id FROM members WHERE google_subject_hash = ?').bind(subjectHash).first();
  if (!member) {
    const emailOwner = await env.DB.prepare('SELECT id FROM members WHERE email_normalized = ?').bind(emailNormalized).first();
    if (emailOwner) throw new HttpError(409, 'That email is already linked to another AMR account');
    member = { id: crypto.randomUUID() };
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO members (id, google_subject_hash, email, email_normalized, display_name, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(member.id, subjectHash, email, emailNormalized, displayName, avatar),
      env.DB.prepare('INSERT INTO notification_preferences (member_id) VALUES (?)').bind(member.id)
    ]);
  } else {
    await env.DB.prepare(`UPDATE members SET email = ?, email_normalized = ?, display_name = ?, avatar_url = ?,
      updated_at = unixepoch(), last_sign_in_at = unixepoch() WHERE id = ?`)
      .bind(email, emailNormalized, displayName, avatar, member.id).run();
  }
  if (validVisitor(body.visitorKey)) {
    const visitorHash = await digest(env.VISITOR_HASH_SECRET, 'visitor', body.visitorKey);
    await claimLegacyLikes(env.DB, member.id, visitorHash);
  }
  const token = randomToken();
  const tokenHash = await digest(env.SESSION_HMAC_SECRET, 'session', token);
  await env.DB.prepare('INSERT INTO member_sessions (token_hash, member_id, expires_at) VALUES (?, ?, unixepoch() + ?)')
    .bind(tokenHash, member.id, SESSION_SECONDS).run();
  const loaded = await env.DB.prepare(`SELECT m.id, m.email, m.display_name, m.avatar_url, m.role,
    p.cinema_releases, p.investigations, p.series_chapters FROM members m
    JOIN notification_preferences p ON p.member_id = m.id WHERE m.id = ?`).bind(member.id).first();
  return json({ member: memberPayload(loaded), previewSessionToken: env.PREVIEW_MODE === 'true' ? token : undefined },
    200, request.headers.get('Origin') || '', { 'Set-Cookie': sessionCookie(token, env) }, env);
}

async function handleSession(request, env) {
  return json({ member: memberPayload(await currentMember(request, env)) }, 200, request.headers.get('Origin') || '', {}, env);
}

async function requireMember(request, env) {
  requireMembershipConfig(env);
  const member = await currentMember(request, env);
  if (!member) throw new HttpError(401, 'Sign in required');
  return member;
}

async function handleSignOut(request, env) {
  requireBrowserMutation(request, env);
  const member = await currentMember(request, env);
  if (member) await env.DB.prepare('DELETE FROM member_sessions WHERE token_hash = ?').bind(member.tokenHash).run();
  return json({ signedOut: true }, 200, request.headers.get('Origin') || '', { 'Set-Cookie': sessionCookie('', env, 0) }, env);
}

async function handleProfile(request, env) {
  requireBrowserMutation(request, env);
  const member = await requireMember(request, env);
  const displayName = cleanDisplayName((await readJson(request)).displayName);
  await env.DB.prepare('UPDATE members SET display_name = ?, updated_at = unixepoch() WHERE id = ?')
    .bind(displayName, member.id).run();
  member.display_name = displayName;
  return json({ member: memberPayload(member) }, 200, request.headers.get('Origin') || '', {}, env);
}

async function handlePreferences(request, env) {
  requireBrowserMutation(request, env);
  const member = await requireMember(request, env);
  const body = await readJson(request);
  const cinema = body.cinemaReleases === true ? 1 : 0;
  const investigations = body.investigations === true ? 1 : 0;
  const series = body.seriesChapters === true ? 1 : 0;
  const anyEnabled = cinema || investigations || series;
  const previousEnabled = member.cinema_releases || member.investigations || member.series_chapters;
  await env.DB.prepare(`UPDATE notification_preferences SET cinema_releases = ?, investigations = ?, series_chapters = ?,
    consent_version = ?, consented_at = CASE WHEN ? = 0 THEN NULL WHEN consented_at IS NULL THEN unixepoch() ELSE consented_at END,
    unsubscribe_version = unsubscribe_version + CASE WHEN ? = 1 AND ? = 0 THEN 1 ELSE 0 END,
    updated_at = unixepoch() WHERE member_id = ?`)
    .bind(cinema, investigations, series, anyEnabled ? CONSENT_VERSION : null, anyEnabled ? 1 : 0,
      anyEnabled ? 1 : 0, previousEnabled ? 1 : 0, member.id).run();
  const updated = await currentMember(request, env);
  return json({ preferences: memberPayload(updated).preferences }, 200, request.headers.get('Origin') || '', {}, env);
}

async function handleAccountDeletion(request, env) {
  requireBrowserMutation(request, env);
  const member = await requireMember(request, env);
  const body = await readJson(request);
  if (String(body.confirmEmail || '').trim().toLowerCase() !== member.email.toLowerCase()) {
    throw new HttpError(400, 'Enter your account email to confirm deletion');
  }
  await env.DB.prepare('DELETE FROM members WHERE id = ?').bind(member.id).run();
  return json({ deleted: true }, 200, request.headers.get('Origin') || '', { 'Set-Cookie': sessionCookie('', env, 0) }, env);
}

async function verifyTurnstile(request, body, env) {
  if (env.TURNSTILE_REQUIRED !== 'true') return;
  if (typeof env.TURNSTILE_SECRET_KEY !== 'string' || !body.turnstileToken) throw new HttpError(400, 'Human verification required');
  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', body.turnstileToken);
  form.set('remoteip', request.headers.get('CF-Connecting-IP') || '');
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const result = response.ok ? await response.json() : { success: false };
  if (!result.success) throw new HttpError(400, 'Human verification failed');
}

async function listComments(request, env, videoId) {
  const member = await currentMember(request, env);
  const rows = await env.DB.prepare(`SELECT c.id, c.body, c.created_at, c.member_id, m.display_name, m.avatar_url
    FROM comments c JOIN members m ON m.id = c.member_id WHERE c.video_id = ? AND c.status = 'visible'
    ORDER BY c.created_at DESC LIMIT 100`).bind(videoId).all();
  return json({ comments: (rows.results || []).map(row => ({
    id: row.id, body: row.body, createdAt: Number(row.created_at), displayName: row.display_name,
    avatarUrl: row.avatar_url || null, own: member?.id === row.member_id
  })) }, 200, request.headers.get('Origin') || '', {}, env);
}

function cleanComment(value) {
  const body = String(value || '').normalize('NFKC').replace(/\r\n/g, '\n').trim();
  if (!body || body.length > COMMENT_LIMIT) throw new HttpError(400, `Comments must be 1–${COMMENT_LIMIT} characters`);
  if ((body.match(/https?:\/\//gi) || []).length > 2) throw new HttpError(400, 'Comments may include at most two links');
  return body;
}

async function createComment(request, env, ctx, videoId) {
  requireBrowserMutation(request, env);
  const member = await requireMember(request, env);
  const body = await readJson(request);
  if (body.website) throw new HttpError(400, 'Comment rejected');
  await verifyTurnstile(request, body, env);
  await enforceRateLimit(request, env, ctx, 'comment', 5);
  const comment = cleanComment(body.body);
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO comments (id, video_id, member_id, body) VALUES (?, ?, ?, ?)')
    .bind(id, videoId, member.id, comment).run();
  return json({ comment: { id, body: comment, createdAt: Math.floor(Date.now() / 1000),
    displayName: member.display_name, avatarUrl: member.avatar_url || null, own: true } },
    201, request.headers.get('Origin') || '', {}, env);
}

async function deleteComment(request, env, commentId) {
  requireBrowserMutation(request, env);
  const member = await requireMember(request, env);
  const deleted = await env.DB.prepare('DELETE FROM comments WHERE id = ? AND member_id = ? RETURNING id')
    .bind(commentId, member.id).first();
  if (!deleted) throw new HttpError(404, 'Comment not found');
  return json({ deleted: true }, 200, request.headers.get('Origin') || '', {}, env);
}

async function reportComment(request, env, commentId) {
  requireBrowserMutation(request, env);
  const member = await requireMember(request, env);
  const body = await readJson(request);
  if (!new Set(['spam', 'harassment', 'misinformation', 'other']).has(body.reason)) throw new HttpError(400, 'Invalid report reason');
  await env.DB.prepare(`INSERT OR IGNORE INTO comment_reports (id, comment_id, reporter_member_id, reason)
    VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), commentId, member.id, body.reason).run();
  return json({ reported: true }, 200, request.headers.get('Origin') || '', {}, env);
}

async function moderateComment(request, env, commentId) {
  requireBrowserMutation(request, env);
  const member = await requireMember(request, env);
  if (member.role !== 'moderator') throw new HttpError(403, 'Moderator access required');
  const body = await readJson(request);
  if (!['hide', 'restore'].includes(body.action)) throw new HttpError(400, 'Invalid moderation action');
  const status = body.action === 'hide' ? 'hidden' : 'visible';
  const updated = await env.DB.prepare('UPDATE comments SET status = ?, updated_at = unixepoch() WHERE id = ? RETURNING id')
    .bind(status, commentId).first();
  if (!updated) throw new HttpError(404, 'Comment not found');
  await env.DB.prepare('INSERT INTO moderation_audit (id, moderator_member_id, comment_id, action) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), member.id, commentId, body.action).run();
  return json({ moderated: true, status }, 200, request.headers.get('Origin') || '', {}, env);
}

async function handleMemberLikeState(request, env, videoId) {
  const member = await requireMember(request, env);
  const row = await env.DB.prepare('SELECT 1 AS liked FROM member_likes WHERE video_id = ? AND member_id = ?')
    .bind(videoId, member.id).first();
  return json({ liked: Boolean(row) }, 200, request.headers.get('Origin') || '', {}, env);
}

async function handleVideoMutation(request, env, ctx, videoId, action) {
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin, env)) throw new HttpError(403, 'Origin denied');
  const body = await readJson(request);
  if (!validVisitor(body?.visitorKey)) throw new HttpError(400, 'Invalid visitor key');
  if (action === 'view' && body.qualifiedSeconds !== 3) throw new HttpError(400, 'Invalid view threshold');
  await enforceRateLimit(request, env, ctx, action, action === 'view' ? 6 : 10);
  const visitorHash = await digest(env.VISITOR_HASH_SECRET, 'visitor', body.visitorKey);
  if (action === 'view') {
    await env.DB.prepare('INSERT OR IGNORE INTO qualified_views (video_id, visitor_hash, view_day) VALUES (?, ?, ?)')
      .bind(videoId, visitorHash, new Date().toISOString().slice(0, 10)).run();
    return json(await totals(env.DB, videoId), 200, origin, {}, env);
  }
  const member = await currentMember(request, env);
  if (member) {
    const memberStatement = request.method === 'PUT'
      ? env.DB.prepare('INSERT OR IGNORE INTO member_likes (video_id, member_id) VALUES (?, ?)').bind(videoId, member.id)
      : env.DB.prepare('DELETE FROM member_likes WHERE video_id = ? AND member_id = ?').bind(videoId, member.id);
    await env.DB.batch([memberStatement,
      env.DB.prepare('DELETE FROM likes WHERE video_id = ? AND visitor_hash = ?').bind(videoId, visitorHash)]);
  } else if (request.method === 'PUT') {
    await env.DB.prepare('INSERT OR IGNORE INTO likes (video_id, visitor_hash) VALUES (?, ?)').bind(videoId, visitorHash).run();
  } else {
    await env.DB.prepare('DELETE FROM likes WHERE video_id = ? AND visitor_hash = ?').bind(videoId, visitorHash).run();
  }
  return json(await totals(env.DB, videoId), 200, origin, {}, env);
}

function timingSafeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function unsubscribeToken(memberId, version, env) {
  if (typeof env.UNSUBSCRIBE_HMAC_SECRET !== 'string' || env.UNSUBSCRIBE_HMAC_SECRET.length < 32) {
    throw new HttpError(503, 'Unsubscribe service unavailable');
  }
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ memberId, version })));
  return `${payload}.${await digest(env.UNSUBSCRIBE_HMAC_SECRET, 'unsubscribe', payload)}`;
}

async function verifyUnsubscribeToken(token, env) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) throw new HttpError(400, 'Invalid unsubscribe link');
  const expected = await digest(env.UNSUBSCRIBE_HMAC_SECRET, 'unsubscribe', payload);
  if (!timingSafeEqual(signature, expected)) throw new HttpError(400, 'Invalid unsubscribe link');
  const data = decodeJsonPart(payload);
  if (typeof data.memberId !== 'string' || !Number.isInteger(data.version)) throw new HttpError(400, 'Invalid unsubscribe link');
  return data;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function handleUnsubscribe(request, env, url) {
  const data = await verifyUnsubscribeToken(url.searchParams.get('token'), env);
  const preference = await env.DB.prepare('SELECT unsubscribe_version FROM notification_preferences WHERE member_id = ?')
    .bind(data.memberId).first();
  if (!preference || Number(preference.unsubscribe_version) !== data.version) throw new HttpError(400, 'This unsubscribe link is no longer active');
  if (request.method === 'GET') {
    return html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe from AMR</title><style>body{max-width:42rem;margin:4rem auto;padding:1rem;background:#111319;color:#eee7d6;font:18px/1.6 Georgia}button{padding:.8rem 1rem;background:#d2a84a;border:0;font-weight:700}</style><h1>Unsubscribe from AMR notifications?</h1><p>This turns off all release email categories. Your free membership remains active.</p><form method="post"><button>Unsubscribe</button></form>`);
  }
  await env.DB.prepare(`UPDATE notification_preferences SET cinema_releases = 0, investigations = 0, series_chapters = 0,
    consented_at = NULL, consent_version = NULL, unsubscribe_version = unsubscribe_version + 1,
    updated_at = unixepoch() WHERE member_id = ?`).bind(data.memberId).run();
  return html('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribed</title><style>body{max-width:42rem;margin:4rem auto;padding:1rem;background:#111319;color:#eee7d6;font:18px/1.6 Georgia}</style><h1>You are unsubscribed.</h1><p>Your AMR membership remains active. You can choose individual categories again from My AMR.</p>');
}

async function handleRelease(request, env) {
  if (!['preview', 'live'].includes(env.NOTIFICATION_MODE)) throw new HttpError(503, 'Notifications are disabled');
  const authorization = request.headers.get('Authorization') || '';
  if (typeof env.RELEASE_WEBHOOK_SECRET !== 'string' || !timingSafeEqual(authorization, `Bearer ${env.RELEASE_WEBHOOK_SECRET}`)) {
    throw new HttpError(401, 'Unauthorized');
  }
  const body = await readJson(request);
  if (!validId(body.id) || !['cinema', 'investigation', 'series'].includes(body.category)
    || body.status !== 'published' || typeof body.title !== 'string' || body.title.trim().length > 160) {
    throw new HttpError(400, 'Invalid release');
  }
  let releaseUrl;
  try { releaseUrl = new URL(body.url); } catch { throw new HttpError(400, 'Invalid release URL'); }
  if (!['https://ancientmysteriesrediscovered.com', 'https://www.ancientmysteriesrediscovered.com'].includes(releaseUrl.origin)) {
    throw new HttpError(400, 'Invalid release URL');
  }
  const publishedAt = Math.floor(new Date(body.publishedAt).getTime() / 1000);
  if (!Number.isFinite(publishedAt) || publishedAt > Math.floor(Date.now() / 1000) + 300) throw new HttpError(400, 'Release is not published');
  await env.DB.prepare(`INSERT OR IGNORE INTO release_events (id, category, title, url, status, published_at)
    VALUES (?, ?, ?, ?, 'published', ?)`).bind(body.id, body.category, body.title.trim(), releaseUrl.href, publishedAt).run();
  const preferenceColumn = { cinema: 'cinema_releases', investigation: 'investigations', series: 'series_chapters' }[body.category];
  await env.DB.prepare(`INSERT OR IGNORE INTO notification_deliveries (member_id, release_id)
    SELECT member_id, ? FROM notification_preferences WHERE ${preferenceColumn} = 1
    AND consented_at IS NOT NULL AND consented_at <= ?`).bind(body.id, publishedAt).run();
  return json({ accepted: true, notificationMode: env.NOTIFICATION_MODE });
}

async function sendEmail(delivery, env) {
  const token = await unsubscribeToken(delivery.member_id, Number(delivery.unsubscribe_version), env);
  const apiOrigin = env.API_ORIGIN || 'https://api.ancientmysteriesrediscovered.com';
  const unsubscribeUrl = `${apiOrigin}/unsubscribe?token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `amr-${delivery.member_id}-${delivery.release_id}`
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM, to: [delivery.email], subject: `New from AMR: ${delivery.title}`,
      text: `${delivery.title}\n\nExplore the new release: ${delivery.url}\n\nUnsubscribe: ${unsubscribeUrl}`,
      html: `<h1>${escapeHtml(delivery.title)}</h1><p>A new Ancient Mysteries Rediscovered release is ready.</p><p><a href="${escapeHtml(delivery.url)}">Explore the release</a></p><p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p>`,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend ${response.status}`);
  return result.id || null;
}

async function drainNotificationQueue(env) {
  if (env.NOTIFICATION_MODE !== 'live' || !env.RESEND_API_KEY || !env.EMAIL_FROM) return;
  const rows = await env.DB.prepare(`SELECT d.member_id, d.release_id, d.attempts, m.email, r.title, r.url,
    p.unsubscribe_version FROM notification_deliveries d JOIN members m ON m.id = d.member_id
    JOIN release_events r ON r.id = d.release_id JOIN notification_preferences p ON p.member_id = d.member_id
    WHERE d.status IN ('queued', 'failed') AND d.attempts < 3
      AND ((r.category = 'cinema' AND p.cinema_releases = 1)
        OR (r.category = 'investigation' AND p.investigations = 1)
        OR (r.category = 'series' AND p.series_chapters = 1))
    ORDER BY d.created_at LIMIT 25`).all();
  for (const delivery of rows.results || []) {
    const claimed = await env.DB.prepare(`UPDATE notification_deliveries SET status = 'sending', attempts = attempts + 1
      WHERE member_id = ? AND release_id = ? AND status IN ('queued', 'failed') RETURNING member_id`)
      .bind(delivery.member_id, delivery.release_id).first();
    if (!claimed) continue;
    try {
      const providerId = await sendEmail(delivery, env);
      await env.DB.prepare(`UPDATE notification_deliveries SET status = 'sent', provider_message_id = ?,
        sent_at = unixepoch(), last_error = NULL WHERE member_id = ? AND release_id = ?`)
        .bind(providerId, delivery.member_id, delivery.release_id).run();
    } catch (error) {
      await env.DB.prepare(`UPDATE notification_deliveries SET status = 'failed', last_error = ?
        WHERE member_id = ? AND release_id = ?`)
        .bind(String(error?.message || 'Email delivery failed').slice(0, 160), delivery.member_id, delivery.release_id).run();
    }
  }
}

async function handleRequest(request, env, ctx) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') {
    if (!originAllowed(origin, env)) return json({ error: 'Origin denied' }, 403, origin, {}, env);
    return new Response(null, { status: 204,
      headers: { ...corsHeaders(origin, env), Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers' } });
  }
  if (!env.DB || typeof env.VISITOR_HASH_SECRET !== 'string' || env.VISITOR_HASH_SECRET.length < 32) {
    return json({ error: 'Service not configured' }, 503, origin, {}, env);
  }
  if (url.pathname === '/health' && request.method === 'GET') {
    return json({ ok: true, membershipConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.SESSION_HMAC_SECRET),
      notificationMode: env.NOTIFICATION_MODE || 'off' }, 200, origin, {}, env);
  }
  if (url.pathname === '/membership/google' && request.method === 'POST') return handleGoogleSignIn(request, env);
  if (url.pathname === '/membership/session' && request.method === 'GET') return handleSession(request, env);
  if (url.pathname === '/membership/signout' && request.method === 'POST') return handleSignOut(request, env);
  if (url.pathname === '/membership/profile' && request.method === 'PATCH') return handleProfile(request, env);
  if (url.pathname === '/membership/preferences' && request.method === 'PUT') return handlePreferences(request, env);
  if (url.pathname === '/membership/account' && request.method === 'DELETE') return handleAccountDeletion(request, env);
  if (url.pathname === '/internal/releases' && request.method === 'POST') return handleRelease(request, env);
  if (url.pathname === '/unsubscribe' && ['GET', 'POST'].includes(request.method)) return handleUnsubscribe(request, env, url);

  const memberLikeMatch = url.pathname.match(/^\/videos\/([a-z0-9-]+)\/member-like\/?$/);
  if (memberLikeMatch && VIDEO_IDS.has(memberLikeMatch[1]) && request.method === 'GET') return handleMemberLikeState(request, env, memberLikeMatch[1]);
  const commentsMatch = url.pathname.match(/^\/videos\/([a-z0-9-]+)\/comments\/?$/);
  if (commentsMatch && VIDEO_IDS.has(commentsMatch[1])) {
    if (request.method === 'GET') return listComments(request, env, commentsMatch[1]);
    if (request.method === 'POST') return createComment(request, env, ctx, commentsMatch[1]);
    throw new HttpError(405, 'Method not allowed');
  }
  const commentAction = url.pathname.match(/^\/comments\/([0-9a-f-]+)(?:\/(report))?\/?$/i);
  if (commentAction) {
    if (!commentAction[2] && request.method === 'DELETE') return deleteComment(request, env, commentAction[1]);
    if (commentAction[2] === 'report' && request.method === 'POST') return reportComment(request, env, commentAction[1]);
    throw new HttpError(405, 'Method not allowed');
  }
  const moderationMatch = url.pathname.match(/^\/moderation\/comments\/([0-9a-f-]+)\/?$/i);
  if (moderationMatch && request.method === 'POST') return moderateComment(request, env, moderationMatch[1]);
  const videoMatch = url.pathname.match(/^\/videos\/([a-z0-9-]+)(?:\/(like|view))?\/?$/);
  if (!videoMatch || !VIDEO_IDS.has(videoMatch[1])) return json({ error: 'Not found' }, 404, origin, {}, env);
  const [videoId, action] = [videoMatch[1], videoMatch[2] || ''];
  if (!action) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, origin, { Allow: 'GET, OPTIONS' }, env);
    return json(await totals(env.DB, videoId), 200, origin, {}, env);
  }
  const allowedMethods = action === 'like' ? ['PUT', 'DELETE'] : ['POST'];
  if (!allowedMethods.includes(request.method)) {
    return json({ error: 'Method not allowed' }, 405, origin, { Allow: `${allowedMethods.join(', ')}, OPTIONS` }, env);
  }
  return handleVideoMutation(request, env, ctx, videoId, action);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    try { return await handleRequest(request, env, ctx); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, origin, error.headers, env);
      console.error('AMR service request failed', error?.name || 'Error');
      return json({ error: 'AMR service temporarily unavailable' }, 503, origin, {}, env);
    }
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(Promise.all([
      drainNotificationQueue(env),
      env.DB.prepare('DELETE FROM member_sessions WHERE expires_at <= unixepoch()').run()
    ]));
  }
};
