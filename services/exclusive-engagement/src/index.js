// AMR Exclusives engagement service — Cloudflare Worker + D1.
// Anonymous counters are best-effort and are not a fraud-proof audience census.
const VIDEO_IDS = new Set(['enuk', 'laestrygonians', 'land-of-the-dead']);
const ALLOWED_ORIGINS = new Set([
  'https://ancientmysteriesrediscovered.com',
  'https://www.ancientmysteriesrediscovered.com'
]);
const MAX_BODY_BYTES = 2048;
const RATE_WINDOW_MINUTES = 1;
const RATE_RETENTION_MINUTES = 2 * 24 * 60;

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function originAllowed(origin, env = {}) {
  return ALLOWED_ORIGINS.has(origin)
    || (typeof env.PREVIEW_ORIGIN === 'string' && env.PREVIEW_ORIGIN === origin);
}

function corsHeaders(origin, env) {
  if (!originAllowed(origin, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
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
      ...corsHeaders(origin, env),
      ...extraHeaders
    }
  });
}

function validVisitor(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function digest(secret, namespace, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${namespace}:${value}`));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readJson(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Expected JSON');
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Payload too large');
  }
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
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

async function totals(db, videoId) {
  const row = await db.prepare(
    'SELECT likes, views FROM engagement_totals WHERE video_id = ?'
  ).bind(videoId).first();
  if (!row) throw new Error('Missing engagement_totals row');
  return { likes: Number(row.likes), views: Number(row.views) };
}

async function rateLimit(db, key, action, limit) {
  const windowStart = Math.floor(Date.now() / (RATE_WINDOW_MINUTES * 60_000));
  const result = await db.prepare(`
    INSERT INTO rate_events (visitor_hash, action, window_start, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(visitor_hash, action, window_start)
    DO UPDATE SET count = rate_events.count + 1
    WHERE rate_events.count < ?
    RETURNING count
  `).bind(key, action, windowStart, limit).first();
  return { allowed: result !== null && Number(result?.count || 0) <= limit, windowStart };
}

async function cleanupRateEvents(db, windowStart) {
  await db.prepare('DELETE FROM rate_events WHERE window_start < ?')
    .bind(windowStart - RATE_RETENTION_MINUTES)
    .run();
}

function maybeScheduleCleanup(ctx, db, windowStart) {
  const sample = crypto.getRandomValues(new Uint8Array(1))[0];
  if (sample !== 0) return;
  const cleanup = cleanupRateEvents(db, windowStart).catch(() => {});
  if (ctx?.waitUntil) ctx.waitUntil(cleanup);
}

async function handleRequest(request, env, ctx) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/videos\/([a-z0-9-]+)(?:\/(like|view))?\/?$/);

  if (request.method === 'OPTIONS') {
    if (!originAllowed(origin, env)) return json({ error: 'Origin denied' }, 403, origin, {}, env);
    if (!match || !VIDEO_IDS.has(match[1])) return json({ error: 'Unknown video' }, 404, origin, {}, env);
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders(origin, env), 'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers' }
    });
  }

  if (!env.DB || typeof env.VISITOR_HASH_SECRET !== 'string' || env.VISITOR_HASH_SECRET.length < 32) {
    return json({ error: 'Service not configured' }, 503, origin, {}, env);
  }
  if (!match || !VIDEO_IDS.has(match[1])) return json({ error: 'Unknown video' }, 404, origin, {}, env);

  const videoId = match[1];
  const action = match[2] || '';
  if (!action) {
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, origin, { Allow: 'GET, OPTIONS' }, env);
    }
    return json(await totals(env.DB, videoId), 200, origin, {}, env);
  }

  const allowedMethods = action === 'like' ? ['PUT', 'DELETE'] : ['POST'];
  if (!allowedMethods.includes(request.method)) {
    return json(
      { error: 'Method not allowed' },
      405,
      origin,
      { Allow: `${allowedMethods.join(', ')}, OPTIONS` },
      env
    );
  }
  if (!originAllowed(origin, env)) return json({ error: 'Origin denied' }, 403, origin, {}, env);

  const body = await readJson(request);
  if (!validVisitor(body?.visitorKey)) throw new HttpError(400, 'Invalid visitor key');
  if (action === 'view' && body.qualifiedSeconds !== 3) {
    throw new HttpError(400, 'Invalid view threshold');
  }

  const visitorHash = await digest(env.VISITOR_HASH_SECRET, 'visitor', body.visitorKey);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await digest(env.VISITOR_HASH_SECRET, 'ip', ip);
  const rate = await rateLimit(env.DB, ipHash, action, action === 'view' ? 6 : 10);
  maybeScheduleCleanup(ctx, env.DB, rate.windowStart);
  if (!rate.allowed) {
    return json({ error: 'Rate limited' }, 429, origin, { 'Retry-After': '60' }, env);
  }

  if (action === 'like') {
    if (request.method === 'PUT') {
      await env.DB.prepare('INSERT OR IGNORE INTO likes (video_id, visitor_hash) VALUES (?, ?)')
        .bind(videoId, visitorHash)
        .run();
    } else {
      await env.DB.prepare('DELETE FROM likes WHERE video_id = ? AND visitor_hash = ?')
        .bind(videoId, visitorHash)
        .run();
    }
  } else {
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(`
      INSERT OR IGNORE INTO qualified_views (video_id, visitor_hash, view_day)
      VALUES (?, ?, ?)
    `).bind(videoId, visitorHash, day).run();
  }

  return json(await totals(env.DB, videoId), 200, origin, {}, env);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, error.status, origin, error.headers, env);
      }
      console.error('Engagement request failed', error?.name || 'Error');
      return json({ error: 'Engagement service temporarily unavailable' }, 503, origin, {}, env);
    }
  }
};
