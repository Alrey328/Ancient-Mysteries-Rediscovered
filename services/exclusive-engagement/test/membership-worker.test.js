import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';

const schema = fs.readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8');
const ORIGIN = 'https://preview.example';
const VISITOR = '123e4567-e89b-42d3-a456-426614174000';
const CLIENT_ID = 'amr-preview-client.apps.googleusercontent.com';

class Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  first() {
    return this.database.prepare(this.sql).get(...this.values) ?? null;
  }

  all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class TestD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(schema);
  }

  prepare(sql) {
    return new Statement(this.database, sql);
  }

  batch(statements) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

function bindings(db) {
  return {
    DB: db,
    VISITOR_HASH_SECRET: 'visitor-secret-with-at-least-32-characters',
    SESSION_HMAC_SECRET: 'session-secret-with-at-least-32-characters',
    IDENTITY_HMAC_SECRET: 'identity-secret-with-at-least-32-characters',
    UNSUBSCRIBE_HMAC_SECRET: 'unsubscribe-secret-with-at-least-32-characters',
    RELEASE_WEBHOOK_SECRET: 'release-webhook-secret-with-32-characters',
    GOOGLE_CLIENT_ID: CLIENT_ID,
    PREVIEW_ORIGINS: ORIGIN,
    PREVIEW_MODE: 'true',
    SESSION_COOKIE_SAMESITE: 'None',
    TURNSTILE_REQUIRED: 'false',
    NOTIFICATION_MODE: 'preview',
    API_ORIGIN: 'https://api.preview.example'
  };
}

function request(path, { method = 'GET', body, token, origin = ORIGIN, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (origin) requestHeaders.set('Origin', origin);
  requestHeaders.set('X-AMR-Request', '1');
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  return new Request(`https://worker.example${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function responseJson(response) {
  return { status: response.status, headers: response.headers, body: await response.json() };
}

function encode(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64url');
}

async function signIdentity(privateKey, subject, email, nonce) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', kid: 'amr-test-key', typ: 'JWT' });
  const payload = encode({
    iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: subject, email,
    email_verified: true, name: 'AMR Explorer', picture: 'https://lh3.googleusercontent.com/a/test',
    nonce, iat: now, exp: now + 600
  });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey,
    new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`;
}

test('membership, comments, release consent, unsubscribe, and deletion work without touching legacy totals', async () => {
  const db = new TestD1();
  const env = bindings(db);
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'amr-test-key';
  const originalFetch = globalThis.fetch;
  let sentEmail;
  let sentEmailHeaders;
  let resendCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('googleapis.com/oauth2/v3/certs')) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600' }
      });
    }
    if (String(url) === 'https://api.resend.com/emails') {
      resendCalls += 1;
      sentEmail = JSON.parse(options.body);
      sentEmailHeaders = new Headers(options.headers);
      return new Response(JSON.stringify({ id: 'email-preview-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const anonymousLike = await responseJson(await worker.fetch(request('/videos/enuk/like', {
      method: 'PUT', body: { visitorKey: VISITOR }
    }), env, {}));
    assert.deepEqual(anonymousLike.body, { likes: 1, views: 0 });

    const nonce = 'preview-nonce-with-enough-entropy';
    const credential = await signIdentity(keyPair.privateKey, 'google-subject-1', 'explorer@example.com', nonce);
    const signIn = await responseJson(await worker.fetch(request('/membership/google', {
      method: 'POST', body: { credential, nonce, visitorKey: VISITOR }
    }), env, {}));
    assert.equal(signIn.status, 200);
    assert.equal(signIn.body.member.email, 'explorer@example.com');
    assert.deepEqual(signIn.body.member.preferences, {
      cinemaReleases: false, investigations: false, seriesChapters: false
    });
    assert.match(signIn.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=None/);
    const token = signIn.body.previewSessionToken;
    assert.ok(token);

    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM likes').get().count, 0);
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM member_likes').get().count, 1);
    assert.equal(db.database.prepare("SELECT likes FROM engagement_totals WHERE video_id = 'enuk'").get().likes, 1,
      'claiming an anonymous Like must not change the total');

    const memberLike = await responseJson(await worker.fetch(request('/videos/enuk/member-like', { token }), env, {}));
    assert.deepEqual(memberLike.body, { liked: true });

    const comment = await responseJson(await worker.fetch(request('/videos/enuk/comments', {
      method: 'POST', token, body: { body: 'The wild-man tradition deserves a closer source comparison.', website: '' }
    }), env, {}));
    assert.equal(comment.status, 201);
    assert.equal(comment.body.comment.own, true);
    const comments = await responseJson(await worker.fetch(request('/videos/enuk/comments', { token }), env, {}));
    assert.equal(comments.body.comments.length, 1);
    assert.equal(comments.body.comments[0].displayName, 'AMR Explorer');

    const preferences = await responseJson(await worker.fetch(request('/membership/preferences', {
      method: 'PUT', token, body: { cinemaReleases: true, investigations: false, seriesChapters: false }
    }), env, {}));
    assert.deepEqual(preferences.body.preferences, {
      cinemaReleases: true, investigations: false, seriesChapters: false
    });
    db.database.exec("UPDATE notification_preferences SET consented_at = unixepoch() - 20 WHERE member_id = (SELECT id FROM members WHERE email = 'explorer@example.com')");

    const publishedAt = new Date(Date.now() - 10_000).toISOString();
    const release = await responseJson(await worker.fetch(request('/internal/releases', {
      method: 'POST', origin: null,
      headers: { Authorization: `Bearer ${env.RELEASE_WEBHOOK_SECRET}` },
      body: { id: 'cinema-test-release', category: 'cinema', title: 'A Test Film',
        url: 'https://ancientmysteriesrediscovered.com/cinema/', status: 'published', publishedAt }
    }), env, {}));
    assert.deepEqual(release.body, { accepted: true, notificationMode: 'preview' });
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM notification_deliveries').get().count, 1);

    const secondNonce = 'second-preview-nonce-with-entropy';
    const secondCredential = await signIdentity(keyPair.privateKey, 'google-subject-2', 'later@example.com', secondNonce);
    const secondSignIn = await responseJson(await worker.fetch(request('/membership/google', {
      method: 'POST', body: { credential: secondCredential, nonce: secondNonce, visitorKey: crypto.randomUUID() }
    }), env, {}));
    await worker.fetch(request('/membership/preferences', {
      method: 'PUT', token: secondSignIn.body.previewSessionToken,
      body: { cinemaReleases: true, investigations: false, seriesChapters: false }
    }), env, {});
    await worker.fetch(request('/internal/releases', {
      method: 'POST', origin: null,
      headers: { Authorization: `Bearer ${env.RELEASE_WEBHOOK_SECRET}` },
      body: { id: 'cinema-test-release', category: 'cinema', title: 'A Test Film',
        url: 'https://ancientmysteriesrediscovered.com/cinema/', status: 'published', publishedAt }
    }), env, {});
    assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM notification_deliveries').get().count, 1,
      'members who subscribe after publication must not receive a backlog');

    const liveEnv = { ...env, NOTIFICATION_MODE: 'live', RESEND_API_KEY: 'preview-resend-key',
      EMAIL_FROM: 'AMR Preview <preview@updates.example>' };
    let scheduledPromise;
    await worker.scheduled({}, liveEnv, { waitUntil(promise) { scheduledPromise = promise; } });
    await scheduledPromise;
    assert.equal(db.database.prepare("SELECT status FROM notification_deliveries").get().status, 'sent');
    assert.equal(sentEmail.to[0], 'explorer@example.com');
    assert.equal(sentEmail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.equal(sentEmailHeaders.get('Idempotency-Key'), 'amr-' +
      db.database.prepare("SELECT id FROM members WHERE email = 'explorer@example.com'").get().id +
      '-cinema-test-release');
    await worker.scheduled({}, liveEnv, { waitUntil(promise) { scheduledPromise = promise; } });
    await scheduledPromise;
    assert.equal(resendCalls, 1, 'a sent delivery must not be submitted twice');
    const unsubscribeUrl = new URL(sentEmail.headers['List-Unsubscribe'].slice(1, -1));
    const unsubscribePath = `${unsubscribeUrl.pathname}${unsubscribeUrl.search}`;
    const confirmPage = await worker.fetch(request(unsubscribePath, { origin: null }), env, {});
    assert.equal(confirmPage.status, 200);
    const unsubscribed = await worker.fetch(request(unsubscribePath, { method: 'POST', origin: null }), env, {});
    assert.equal(unsubscribed.status, 200);
    assert.equal(db.database.prepare("SELECT cinema_releases FROM notification_preferences WHERE member_id = (SELECT id FROM members WHERE email = 'explorer@example.com')").get().cinema_releases, 0);

    const deletedComment = await worker.fetch(request(`/comments/${comment.body.comment.id}`, { method: 'DELETE', token }), env, {});
    assert.equal(deletedComment.status, 200);
    const deletion = await responseJson(await worker.fetch(request('/membership/account', {
      method: 'DELETE', token, body: { confirmEmail: 'explorer@example.com' }
    }), env, {}));
    assert.deepEqual(deletion.body, { deleted: true });
    assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM members WHERE email = 'explorer@example.com'").get().count, 0);
    assert.equal(db.database.prepare("SELECT likes FROM engagement_totals WHERE video_id = 'enuk'").get().likes, 0,
      'deleting a member removes that member Like without resetting unrelated totals');
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});
