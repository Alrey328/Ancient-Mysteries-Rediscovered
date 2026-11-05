import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const serviceDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoDir = path.resolve(serviceDir, '..', '..');
const exclusivePages = [
  'exclusives/index.html',
  'exclusives/enuk/index.html',
  'exclusives/laestrygonians/index.html'
];
const endpoint = 'https://amr-exclusive-engagement.belizean328.workers.dev';

test('all three AMR Original entry points configure the existing Worker', () => {
  for (const relative of exclusivePages) {
    const html = fs.readFileSync(path.join(repoDir, relative), 'utf8');
    assert.match(html, new RegExp(`<meta name="amr-engagement-api" content="${endpoint}">`));
    assert.match(html, /data-amr-engagement/);
  }
});

test('engagement controls are absent from every non-exclusive HTML page', () => {
  const allowed = new Set(exclusivePages.map(relative => path.normalize(path.join(repoDir, relative))));
  const pending = [repoDir];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      if (entry.isFile() && entry.name.endsWith('.html') && !allowed.has(path.normalize(absolute))) {
        assert.doesNotMatch(fs.readFileSync(absolute, 'utf8'), /data-amr-engagement/, absolute);
      }
    }
  }
});

test('exclusive media paths resolve to repository assets', () => {
  const expectations = new Map([
    ['exclusives/index.html', ['../Enkidu%20Poster.png', '../media/Enuk_AMR_Exclusive_web.mp4']],
    ['exclusives/enuk/index.html', ['../../Enkidu%20Poster.png', '../../media/Enuk_AMR_Exclusive_web.mp4']],
    ['exclusives/laestrygonians/index.html', ['../../assets/originals/laestrygonians/poster.webp', '../../assets/originals/laestrygonians/film.mp4']]
  ]);
  for (const [page, assets] of expectations) {
    const pagePath = path.join(repoDir, page);
    const html = fs.readFileSync(pagePath, 'utf8');
    for (const asset of assets) {
      assert.ok(html.includes(asset), `${page} references ${asset}`);
      assert.ok(fs.existsSync(path.resolve(path.dirname(pagePath), decodeURIComponent(asset))), `${asset} exists`);
    }
  }
});

test('homepage original card uses the configured internal watch page', () => {
  const content = JSON.parse(fs.readFileSync(path.join(repoDir, 'data/site-content.json'), 'utf8'));
  assert.equal(content.featuredOriginal.watchPage, 'exclusives/laestrygonians/');
  assert.equal(content.featuredOriginal.enabled, true);
  const renderer = fs.readFileSync(path.join(repoDir, 'assets/js/amr-premieres.js'), 'utf8');
  assert.match(renderer, /original\.watchPage/);
});
