import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const serviceDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = fs.readFileSync(path.resolve(serviceDir, '..', '..', 'cinema', 'cinema.js'), 'utf8');

function playbackRuntime(play = () => Promise.resolve()) {
  const buttonListeners = new Map();
  const videoListeners = new Map();
  const status = { textContent: '' };
  const button = {
    hidden: false,
    addEventListener(name, handler) { buttonListeners.set(name, handler); }
  };
  const video = {
    muted: true,
    playCalls: 0,
    play() {
      this.playCalls += 1;
      return play();
    },
    addEventListener(name, handler) { videoListeners.set(name, handler); }
  };
  const shell = {
    querySelector(selector) {
      return {
        video,
        '[data-cinema-play]': button,
        '[data-cinema-play-status]': status
      }[selector] || null;
    }
  };
  const context = {
    URL,
    location: { origin: 'https://example.test', pathname: '/cinema/' },
    navigator: {},
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === '[data-cinema-player]' ? [shell] : []; }
    }
  };
  vm.runInNewContext(script, context, { filename: 'cinema.js' });
  return {
    button,
    status,
    video,
    click: () => buttonListeners.get('click')(),
    emit: name => videoListeners.get(name)?.()
  };
}

test('one Play activation starts the selected film once with audio enabled', async () => {
  const page = playbackRuntime();
  await page.click();
  assert.equal(page.video.playCalls, 1);
  assert.equal(page.video.muted, false);
  page.emit('play');
  assert.equal(page.button.hidden, true);
  assert.equal(page.status.textContent, '');
});

test('a blocked play request keeps Play available and reports recovery guidance', async () => {
  const page = playbackRuntime(() => Promise.reject(new Error('NotAllowedError')));
  await page.click();
  assert.equal(page.video.playCalls, 1);
  assert.equal(page.button.hidden, false);
  assert.equal(page.status.textContent, 'Playback could not start. Use the video controls to try again.');
});

test('a media error restores Play and announces that the film failed to load', () => {
  const page = playbackRuntime();
  page.button.hidden = true;
  page.emit('error');
  assert.equal(page.button.hidden, false);
  assert.equal(page.status.textContent, 'This film could not be loaded. Please try again.');
});
