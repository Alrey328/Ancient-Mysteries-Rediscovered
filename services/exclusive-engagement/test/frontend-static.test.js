import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const serviceDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoDir = path.resolve(serviceDir, '..', '..');
const engagementPages = [
  'exclusives/enuk/index.html',
  'exclusives/laestrygonians/index.html',
  'cinema/enuk/index.html',
  'cinema/laestrygonians/index.html'
];
const endpoint = 'https://amr-exclusive-engagement.belizean328.workers.dev';

test('all AMR Original entry points configure the existing Worker', () => {
  for (const relative of engagementPages) {
    const html = fs.readFileSync(path.join(repoDir, relative), 'utf8');
    assert.match(html, new RegExp(`<meta name="amr-engagement-api" content="${endpoint}">`));
    assert.match(html, /data-amr-engagement/);
  }
});

test('engagement controls are absent from every non-AMR-film HTML page', () => {
  const allowed = new Set(engagementPages.map(relative => path.normalize(path.join(repoDir, relative))));
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
    ['exclusives/index.html', ['../assets/originals/land-of-the-dead/poster.png', '../assets/originals/land-of-the-dead/film.mp4']],
    ['exclusives/enuk/index.html', ['../../Enkidu%20Poster.png', '../../media/Enuk_AMR_Exclusive_web.mp4']],
    ['exclusives/laestrygonians/index.html', ['../../assets/originals/laestrygonians/poster.webp', '../../assets/originals/laestrygonians/film.mp4']],
    ['cinema/index.html', ['../assets/originals/land-of-the-dead/poster.png']],
    ['cinema/land-of-the-dead/index.html', ['../../assets/originals/land-of-the-dead/poster.png', '../../assets/originals/land-of-the-dead/film.mp4']]
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

test('homepage AMR Exclusive config features the self-hosted Land of the Dead release', () => {
  const content = JSON.parse(fs.readFileSync(path.join(repoDir, 'data/site-content.json'), 'utf8'));
  assert.equal(content.featuredOriginal.title, 'Odysseus — The Land of the Dead');
  assert.equal(content.featuredOriginal.poster, 'assets/originals/land-of-the-dead/poster.png');
  assert.equal(content.featuredOriginal.videoUrl, 'assets/originals/land-of-the-dead/film.mp4');
  assert.equal(content.featuredOriginal.watchPage, 'exclusives/');
  assert.equal(content.featuredOriginal.enabled, true);
  const renderer = fs.readFileSync(path.join(repoDir, 'assets/js/amr-premieres.js'), 'utf8');
  assert.match(renderer, /data-original-player/);
  assert.match(renderer, /data-original-play/);
  assert.match(renderer, /await video\.play\(\)/);
});

test('existing Cinema viewing pages preserve engagement IDs and media assets', () => {
  const expectations = new Map([
    ['cinema/enuk/index.html', { id: 'enuk', media: '../../media/Enuk_AMR_Exclusive_web.mp4' }],
    ['cinema/laestrygonians/index.html', { id: 'laestrygonians', media: '../../assets/originals/laestrygonians/film.mp4' }]
  ]);
  for (const [page, expectation] of expectations) {
    const pagePath = path.join(repoDir, page);
    const html = fs.readFileSync(pagePath, 'utf8');
    assert.match(html, new RegExp(`data-video-id="${expectation.id}"`));
    assert.ok(html.includes(expectation.media));
    assert.ok(fs.existsSync(path.resolve(path.dirname(pagePath), expectation.media)));
    assert.match(html, /discussions\/discussion-data\.js/);
    assert.match(html, /data-cinema-comments=/);
  }
});

test('Cinema SEO uses one collection canonical and existing film canonicals', () => {
  const expectations = new Map([
    ['cinema/index.html', 'https://ancientmysteriesrediscovered.com/cinema/'],
    ['cinema/enuk/index.html', 'https://ancientmysteriesrediscovered.com/exclusives/enuk/'],
    ['cinema/laestrygonians/index.html', 'https://ancientmysteriesrediscovered.com/exclusives/laestrygonians/'],
    ['cinema/land-of-the-dead/index.html', 'https://ancientmysteriesrediscovered.com/cinema/land-of-the-dead/']
  ]);
  for (const [page, canonical] of expectations) {
    const html = fs.readFileSync(path.join(repoDir, page), 'utf8');
    const matches = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)];
    assert.equal(matches.length, 1, `${page} has one canonical`);
    assert.equal(matches[0][1], canonical);
    const openGraphUrl = html.match(/<meta property="og:url" content="([^"]+)">/)?.[1];
    assert.equal(openGraphUrl, canonical, `${page} Open Graph URL matches its canonical`);
  }
  const sitemap = fs.readFileSync(path.join(repoDir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/ancientmysteriesrediscovered\.com\/cinema\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/ancientmysteriesrediscovered\.com\/cinema\/land-of-the-dead\/<\/loc>/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/ancientmysteriesrediscovered\.com\/cinema\/(enuk|laestrygonians)\/<\/loc>/);
});

test('homepage exposes AMR Cinema without changing premiere destinations', () => {
  const homepage = fs.readFileSync(path.join(repoDir, 'index.html'), 'utf8');
  assert.match(homepage, /<a href="cinema\/">AMR Cinema<\/a>/);
  const content = JSON.parse(fs.readFileSync(path.join(repoDir, 'data/site-content.json'), 'utf8'));
  assert.equal(content.featuredOriginal.watchPage, 'exclusives/');
});

test('AMR Exclusives features Land inline while preserving existing releases', () => {
  const html = fs.readFileSync(path.join(repoDir, 'exclusives/index.html'), 'utf8');
  const videoTag = html.match(/<video\b[^>]*id="featured-video"[^>]*>/)?.[0] || '';
  assert.match(html, /Odysseus — The Land of the Dead/);
  assert.match(videoTag, /\scontrols(?:\s|>)/);
  assert.match(videoTag, /\splaysinline(?:\s|>)/);
  assert.match(videoTag, /\spreload="metadata"/);
  assert.doesNotMatch(videoTag, /\sautoplay(?:\s|=|>)/);
  assert.match(html, /assets\/originals\/land-of-the-dead\/poster\.png/);
  assert.match(html, /assets\/originals\/land-of-the-dead\/film\.mp4/);
  assert.match(html, /id="featured-play"[^>]*aria-label="Play Odysseus — The Land of the Dead"/);
  assert.match(html, /href="enuk\/"/);
  assert.match(html, /href="laestrygonians\/"/);
  assert.match(html, /cinema\/land-of-the-dead\/#comments-title/);
  assert.doesNotMatch(html, /data-amr-engagement|data-video-id=|youtube\.com|youtu\.be/);
});

test('Cinema keeps playback opt-in and exposes accessible controls', () => {
  for (const page of ['cinema/enuk/index.html', 'cinema/laestrygonians/index.html', 'cinema/land-of-the-dead/index.html']) {
    const html = fs.readFileSync(path.join(repoDir, page), 'utf8');
    const videoTag = html.match(/<video\b[^>]*>/)?.[0] || '';
    assert.match(html, /class="skip-link"/);
    assert.match(html, /<h1[^>]*>/);
    assert.match(videoTag, /\scontrols(?:\s|>)/);
    assert.match(videoTag, /\splaysinline(?:\s|>)/);
    assert.match(videoTag, /\spreload="metadata"/);
    assert.match(videoTag, /\saria-label="[^"]+"/);
    assert.doesNotMatch(videoTag, /\sautoplay(?:\s|=|>)/);
    assert.match(html, /<button[^>]*type="button"[^>]*data-share-film/);
    assert.match(html, /<button[^>]*type="button"[^>]*data-load-comments/);
  }
});

test('Cinema uses a direct video to engagement to discussion flow', () => {
  const pages = ['cinema/enuk/index.html', 'cinema/laestrygonians/index.html'];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(repoDir, page), 'utf8');
    const video = html.indexOf('<video');
    const title = html.indexOf('<h1');
    const about = html.indexOf('<details class="viewer-about">');
    const engagement = html.indexOf('data-amr-engagement');
    const share = html.indexOf('data-share-film');
    const comments = html.indexOf('data-cinema-comments');
    const libraryLink = html.indexOf('href="../#film-library"');
    assert.ok(video >= 0 && video < title, `${page}: video precedes the compact title`);
    assert.ok(title < about && about < engagement, `${page}: title and About disclosure precede engagement`);
    assert.ok(engagement < share, `${page}: engagement precedes share`);
    assert.ok(share < comments, `${page}: sharing precedes discussion`);
    assert.ok(libraryLink >= 0, `${page}: links directly to the compact film library`);
    assert.doesNotMatch(html, /viewer-intro|viewer-breadcrumb/);
  }
  const cinemaHome = fs.readFileSync(path.join(repoDir, 'cinema/index.html'), 'utf8');
  assert.doesNotMatch(cinemaHome, /cinema-hero|Choose a film|Enter screening/);
  const cinemaScript = fs.readFileSync(path.join(repoDir, 'cinema/cinema.js'), 'utf8');
  assert.match(cinemaScript, /renderGiscus\(target, term, 'specific'\)/);
  const cinemaStyles = fs.readFileSync(path.join(repoDir, 'cinema/cinema.css'), 'utf8');
  assert.match(cinemaStyles, /\.cinema-nav\s*\{[^}]*min-height:\s*62px/s);
  assert.match(cinemaStyles, /\.viewer-player-shell\s*\{[^}]*40\.5vh/s);
});

test('Land of the Dead is the featured self-hosted release without backend changes', () => {
  for (const page of ['cinema/land-of-the-dead/index.html']) {
    const html = fs.readFileSync(path.join(repoDir, page), 'utf8');
    const video = html.indexOf('<video');
    const title = html.indexOf('<h1');
    const share = html.indexOf('data-share-film');
    const comments = html.indexOf('data-cinema-comments');
    assert.match(html, /Odysseus — The Land of the Dead/);
    assert.match(html, /assets\/originals\/land-of-the-dead\/film\.mp4/);
    assert.match(html, /assets\/originals\/land-of-the-dead\/poster\.png/);
    assert.match(html, /data-cinema-comments="cinema-land-of-the-dead"/);
    assert.ok(video >= 0 && video < title && title < share && share < comments, `${page}: direct viewer flow`);
    assert.doesNotMatch(html, /data-amr-engagement|engagement\.js|youtube\.com|youtu\.be/);
  }
});

test('each Cinema viewing page preserves one-click playback', () => {
  for (const page of ['cinema/enuk/index.html', 'cinema/laestrygonians/index.html', 'cinema/land-of-the-dead/index.html']) {
    const html = fs.readFileSync(path.join(repoDir, page), 'utf8');
    const players = [...html.matchAll(/data-cinema-player/g)];
    const playButtons = [...html.matchAll(/data-cinema-play(?:\s|>)/g)];
    assert.equal(players.length, 1, `${page}: includes one primary player`);
    assert.equal(playButtons.length, players.length, `${page}: every player has one Play control`);
    assert.doesNotMatch(html, /<video\b[^>]*\sautoplay(?:\s|=|>)/);
  }
});

test('Cinema exposes all published films in a compact responsive library', () => {
  const html = fs.readFileSync(path.join(repoDir, 'cinema/index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(repoDir, 'cinema/cinema.css'), 'utf8');
  const library = html.match(/<section[^>]*id="film-library"[\s\S]*?<\/section>/)?.[0] || '';

  assert.equal([...library.matchAll(/class="cinema-library-card"/g)].length, 3);
  assert.match(library, /href="\.\/land-of-the-dead\/"/);
  assert.match(library, /href="\.\/laestrygonians\/"/);
  assert.match(library, /href="\.\/enuk\/"/);
  assert.match(library, /assets\/originals\/land-of-the-dead\/poster\.png/);
  assert.match(library, /assets\/originals\/laestrygonians\/poster\.webp/);
  assert.match(library, /Enkidu%20Poster\.png/);
  assert.match(library, /Odysseus — The Land of the Dead/);
  assert.match(library, /The Laestrygonians/);
  assert.match(library, /Enuk: The Wildman/);
  assert.doesNotMatch(library, /<video\b/);
  assert.match(html, /<main[^>]*>\s*<section[^>]*id="film-library"/s);
  assert.doesNotMatch(html, /viewer-stage|data-cinema-player|data-cinema-comments/);
  assert.match(styles, /\.cinema-library-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
  assert.match(styles, /\.cinema-library-poster img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.cinema-library-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);

  for (const page of ['cinema/enuk/index.html', 'cinema/laestrygonians/index.html', 'cinema/land-of-the-dead/index.html']) {
    const viewingPage = fs.readFileSync(path.join(repoDir, page), 'utf8');
    assert.match(viewingPage, /href="\.\.\/#film-library">Explore More AMR Videos<\/a>/);
  }
});
