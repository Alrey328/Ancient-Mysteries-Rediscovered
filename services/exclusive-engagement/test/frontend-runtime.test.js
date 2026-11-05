import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const serviceDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const componentSource = fs.readFileSync(
  path.resolve(serviceDir, '..', '..', 'exclusives', 'engagement.js'),
  'utf8'
);

function runtime(runtimeOptions = {}) {
  const listeners = new Map();
  const buttonListeners = new Map();
  const windowListeners = new Map();
  const calls = [];
  const storage = new Map(runtimeOptions.storageEntries || []);
  const nodes = {
    button: {
      disabled: true,
      textContent: '♡ Like',
      attributes: new Map(),
      setAttribute(name, value) { this.attributes.set(name, value); },
      addEventListener(name, handler) { buttonListeners.set(name, handler); }
    },
    likes: { textContent: 'Likes unavailable' },
    views: { textContent: 'Views unavailable' },
    status: { textContent: '' }
  };
  const video = {
    paused: true,
    ended: false,
    seeking: false,
    readyState: 4,
    currentTime: 0,
    playbackRate: 8,
    addEventListener(name, handler) { listeners.set(name, handler); }
  };
  const root = {
    dataset: { videoId: 'enuk', playerId: 'enuk-video' },
    querySelector(selector) {
      return {
        '[data-amr-like]': nodes.button,
        '[data-amr-likes]': nodes.likes,
        '[data-amr-views]': nodes.views,
        '[data-amr-status]': nodes.status
      }[selector];
    }
  };
  let now = 0;
  let intervalHandler;
  let intervalId = 0;
  const context = {
    AbortController,
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    console,
    crypto: webcrypto,
    document: {
      querySelector: selector => selector === 'meta[name="amr-engagement-api"]'
        ? { content: 'https://worker.example' }
        : null,
      querySelectorAll: selector => selector === '[data-amr-engagement]' ? [root] : [],
      getElementById: id => id === 'enuk-video' ? video : null
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (runtimeOptions.fetch) return runtimeOptions.fetch(url, options);
      return { ok: true, status: 200, json: async () => ({ likes: 4, views: 7 }) };
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    performance: { now: () => now },
    setInterval: handler => { intervalHandler = handler; intervalId += 1; return intervalId; },
    clearInterval: () => { intervalHandler = undefined; },
    setTimeout: () => 1,
    clearTimeout: () => {},
    window: {
      addEventListener(name, handler) { windowListeners.set(name, handler); }
    }
  };
  vm.runInNewContext(componentSource, context, { filename: 'engagement.js' });
  return {
    calls,
    click() { return buttonListeners.get('click')?.(); },
    emit(name) { listeners.get(name)?.(); },
    emitWindow(name) { windowListeners.get(name)?.(); },
    nodes,
    storage,
    video,
    tick(milliseconds = 250) {
      now += milliseconds;
      video.currentTime += (milliseconds / 1000) * video.playbackRate;
      intervalHandler?.();
    }
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('fast playback still requires three wall-clock seconds before one View submission', async () => {
  const page = runtime();
  await flush();
  assert.equal(page.calls.length, 1, 'initial totals GET');
  assert.equal(page.nodes.button.disabled, false);
  page.video.paused = false;
  page.emit('playing');

  for (let index = 0; index < 12; index += 1) page.tick();
  await flush();
  assert.equal(page.calls.filter(call => call.options.method === 'POST').length, 0);

  page.tick();
  await flush();
  assert.equal(page.calls.filter(call => call.options.method === 'POST').length, 1);

  // Continuing or looping in the same page session cannot submit again.
  for (let index = 0; index < 20; index += 1) page.tick();
  page.emit('playing');
  for (let index = 0; index < 20; index += 1) page.tick();
  await flush();
  assert.equal(page.calls.filter(call => call.options.method === 'POST').length, 1);
});

test('pause time and seeking jumps do not qualify as playback', async () => {
  const page = runtime();
  await flush();
  page.video.paused = false;
  page.emit('playing');
  for (let index = 0; index < 5; index += 1) page.tick();
  page.video.paused = true;
  page.emit('pause');
  page.tick(5000);
  page.video.currentTime += 100;
  page.video.seeking = true;
  page.emit('seeking');
  page.video.seeking = false;
  page.video.paused = false;
  page.emit('playing');
  for (let index = 0; index < 8; index += 1) page.tick();
  await flush();
  assert.equal(page.calls.filter(call => call.options.method === 'POST').length, 0);
});

test('refresh restores liked state and permits unlike then Like again', async () => {
  let totals = { likes: 1, views: 1 };
  const page = runtime({
    storageEntries: [
      ['amr-exclusive-liked:enuk', 'yes'],
      ['amr-exclusive-visitor-v1', '123e4567-e89b-42d3-a456-426614174000']
    ],
    fetch: async (_url, options) => {
      if (options.method === 'DELETE') totals = { ...totals, likes: 0 };
      if (options.method === 'PUT') totals = { ...totals, likes: 1 };
      return { ok: true, status: 200, json: async () => totals };
    }
  });
  await flush();

  assert.equal(page.nodes.button.disabled, false);
  assert.equal(page.nodes.button.attributes.get('aria-pressed'), 'true');
  assert.equal(page.nodes.button.textContent, '♥ Liked');

  await page.click();
  assert.equal(page.calls.at(-1).options.method, 'DELETE');
  assert.equal(page.storage.get('amr-exclusive-liked:enuk'), 'no');
  assert.equal(page.nodes.button.disabled, false);
  assert.equal(page.nodes.button.textContent, '♡ Like');
  assert.equal(page.nodes.likes.textContent, '0 Likes');

  await page.click();
  assert.equal(page.calls.at(-1).options.method, 'PUT');
  assert.equal(page.storage.get('amr-exclusive-liked:enuk'), 'yes');
  assert.equal(page.nodes.button.disabled, false);
  assert.equal(page.nodes.button.textContent, '♥ Liked');
  assert.equal(page.nodes.likes.textContent, '1 Like');
});

test('pageshow repairs a browser-restored disabled state after totals load', async () => {
  const page = runtime({
    storageEntries: [['amr-exclusive-liked:enuk', 'yes']]
  });
  await flush();
  assert.equal(page.nodes.button.disabled, false);

  // Chrome may restore the static disabled form-control state during navigation.
  page.nodes.button.disabled = true;
  page.emitWindow('pageshow');

  assert.equal(page.nodes.button.disabled, false);
  assert.equal(page.nodes.button.attributes.get('aria-pressed'), 'true');
  assert.equal(page.nodes.button.textContent, '♥ Liked');
});

test('a Like mutation failure preserves loaded totals and re-enables the control', async () => {
  let requestCount = 0;
  const page = runtime({
    fetch: async () => {
      requestCount += 1;
      if (requestCount > 1) throw new Error('simulated mutation failure');
      return { ok: true, status: 200, json: async () => ({ likes: 1, views: 1 }) };
    }
  });
  await flush();
  await page.click();

  assert.equal(page.nodes.likes.textContent, '1 Like');
  assert.equal(page.nodes.views.textContent, '1 View');
  assert.equal(page.nodes.button.disabled, false);
  assert.equal(page.nodes.status.textContent, 'Could not update your Like. Please try again.');
});
