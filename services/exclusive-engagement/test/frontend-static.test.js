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
    ['exclusives/index.html', ['../assets/originals/sirens/poster.webp', '../assets/originals/sirens/film.mp4', '../assets/originals/land-of-the-dead/poster.png', '../assets/originals/land-of-the-dead/film.mp4', '../Enkidu%20Poster.png', '../media/Enuk_AMR_Exclusive_web.mp4', '../assets/originals/laestrygonians/poster.webp', '../assets/originals/laestrygonians/film.mp4']],
    ['exclusives/enuk/index.html', ['../../Enkidu%20Poster.png', '../../media/Enuk_AMR_Exclusive_web.mp4']],
    ['exclusives/laestrygonians/index.html', ['../../assets/originals/laestrygonians/poster.webp', '../../assets/originals/laestrygonians/film.mp4']],
    ['cinema/index.html', ['../assets/originals/land-of-the-dead/poster.png', '../assets/originals/land-of-the-dead/film.mp4', '../assets/originals/sirens/poster.webp', '../assets/originals/sirens/film.mp4']],
    ['cinema/land-of-the-dead/index.html', ['../../assets/originals/land-of-the-dead/poster.png', '../../assets/originals/land-of-the-dead/film.mp4']],
    ['cinema/sirens/index.html', ['../../assets/originals/sirens/poster.webp', '../../assets/originals/sirens/film.mp4']]
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

test('homepage AMR Exclusive config follows the canonical Sirens feature', () => {
  const content = JSON.parse(fs.readFileSync(path.join(repoDir, 'data/site-content.json'), 'utf8'));
  assert.equal(content.featuredOriginal.title, 'The Sirens — Ancient Legend Unveiled');
  assert.equal(content.featuredOriginal.poster, 'assets/originals/sirens/poster.webp');
  assert.equal(content.featuredOriginal.videoUrl, 'assets/originals/sirens/film.mp4');
  assert.equal(content.featuredOriginal.watchPage, 'cinema/sirens/');
  assert.equal(content.featuredOriginal.enabled, true);
  assert.ok(fs.existsSync(path.join(repoDir, content.featuredOriginal.poster)));
  assert.ok(fs.existsSync(path.join(repoDir, content.featuredOriginal.videoUrl)));
  // Preserve the other two premiere selections and the Dual Featured Premieres shell.
  assert.equal(content.featuredReel.videoUrl, 'https://www.facebook.com/share/r/1EtfycqkWy/');
  assert.equal(content.featuredYoutubeId, 'island-of-giants-immersive');
  const homepage = fs.readFileSync(path.join(repoDir, 'index.html'), 'utf8');
  assert.match(homepage, /id="premiere-stage-title">Dual Featured Premieres/);
  assert.match(homepage, /data-muted-src="assets\/hero\/amr-hero-web\.mp4"/);
  const renderer = fs.readFileSync(path.join(repoDir, 'assets/js/amr-premieres.js'), 'utf8');
  assert.match(renderer, /data-original-player/);
  assert.match(renderer, /data-original-play/);
  assert.match(renderer, /video\.muted = false/);
  assert.match(renderer, /await video\.play\(\)/);
  // The initial poster must not show a native mobile play control beneath AMR's Play button.
  assert.match(renderer, /<video playsinline preload="metadata" poster=/);
  assert.doesNotMatch(renderer, /<video controls playsinline preload="metadata" poster=/);
  // Native controls return when playback starts, then give way to the overlay on completion.
  assert.match(renderer, /video\.addEventListener\('play',[\s\S]*?video\.controls = true;/);
  assert.match(renderer, /video\.addEventListener\('ended',[\s\S]*?video\.controls = false;/);
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
    ['cinema/enuk/index.html', 'https://ancientmysteriesrediscovered.com/cinema/enuk/'],
    ['cinema/laestrygonians/index.html', 'https://ancientmysteriesrediscovered.com/cinema/laestrygonians/'],
    ['cinema/land-of-the-dead/index.html', 'https://ancientmysteriesrediscovered.com/cinema/land-of-the-dead/'],
    ['cinema/sirens/index.html', 'https://ancientmysteriesrediscovered.com/cinema/sirens/']
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
  assert.match(sitemap, /<loc>https:\/\/ancientmysteriesrediscovered\.com\/cinema\/sirens\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/ancientmysteriesrediscovered\.com\/cinema\/enuk\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/ancientmysteriesrediscovered\.com\/cinema\/laestrygonians\/<\/loc>/);
});

test('homepage exposes AMR Cinema without changing premiere destinations', () => {
  const homepage = fs.readFileSync(path.join(repoDir, 'index.html'), 'utf8');
  assert.match(homepage, /<a href="cinema\/">AMR Cinema<\/a>/);
  const content = JSON.parse(fs.readFileSync(path.join(repoDir, 'data/site-content.json'), 'utf8'));
  assert.equal(content.featuredOriginal.watchPage, 'cinema/sirens/');
});

test('AMR Exclusives is generated from the canonical manifest and preserves every release', () => {
  const html = fs.readFileSync(path.join(repoDir, 'exclusives/index.html'), 'utf8');
  for (const slug of ['sirens', 'land-of-the-dead', 'laestrygonians', 'enuk']) {
    assert.match(html, new RegExp(`href="\\.\\.\\/cinema\\/${slug}\\/"`));
  }
  assert.equal([...html.matchAll(/data-cinema-player/g)].length, 4);
  assert.equal([...html.matchAll(/data-cinema-play(?:\s|>)/g)].length, 4);
  assert.match(html, /viewer-related-video[^>]*\scontrols(?:\s|>)/);
  assert.doesNotMatch(html, /<video\b[^>]*\sautoplay(?:\s|=|>)/);
  assert.doesNotMatch(html, /data-amr-engagement|data-video-id=|youtube\.com|youtu\.be/);
});


test('mobile Exclusives library shows all manifest films with one-tap inline playback', () => {
  const html = fs.readFileSync(path.join(repoDir, 'exclusives/index.html'), 'utf8');
  const films = [
    { id: 'sirens', title: 'The Sirens — Ancient Legend Unveiled', poster: '../assets/originals/sirens/poster.webp', film: '../assets/originals/sirens/film.mp4' },
    { id: 'land-of-the-dead', title: 'Odysseus — The Land of the Dead', poster: '../assets/originals/land-of-the-dead/poster.png', film: '../assets/originals/land-of-the-dead/film.mp4' },
    { id: 'enuk', title: 'Enuk: The Wildman', poster: '../Enkidu%20Poster.png', film: '../media/Enuk_AMR_Exclusive_web.mp4' },
    { id: 'laestrygonians', title: 'The Laestrygonians', poster: '../assets/originals/laestrygonians/poster.webp', film: '../assets/originals/laestrygonians/film.mp4' }
  ];
  assert.equal([...html.matchAll(/<div[^>]*data-cinema-player[^>]*>/g)].length, films.length);
  for (const film of films) {
    assert.ok(html.includes('poster="' + film.poster + '"'));
    assert.ok(html.includes('src="' + film.film + '"'));
    assert.ok(html.includes('data-cinema-play aria-label="Play ' + film.title + ' here"'));
    assert.ok(html.includes('href="../cinema/' + film.id + '/"'));
  }
  assert.doesNotMatch(html, /data-amr-engagement|data-video-id=|youtube\.com|youtu\.be/);
});

test('Cinema keeps playback opt-in and exposes accessible controls', () => {
  for (const page of ['cinema/index.html', 'cinema/enuk/index.html', 'cinema/laestrygonians/index.html', 'cinema/land-of-the-dead/index.html', 'cinema/sirens/index.html']) {
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
    const recommendations = html.indexOf('id="recommendations"');
    assert.ok(video >= 0 && video < title, `${page}: video precedes the compact title`);
    assert.ok(title < about && about < engagement, `${page}: title and About disclosure precede engagement`);
    assert.ok(engagement < share, `${page}: engagement precedes share`);
    assert.ok(share < comments, `${page}: sharing precedes discussion`);
    assert.ok(comments < recommendations, `${page}: discussion precedes recommendations`);
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

test('Land of the Dead remains a self-hosted release without backend changes', () => {
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

test('Sirens is the owner-selected Cinema collection feature', () => {
  const html = fs.readFileSync(path.join(repoDir, 'cinema/index.html'), 'utf8');
  assert.match(html, /The Sirens — Ancient Legend Unveiled/);
  assert.match(html, /assets\/originals\/sirens\/film\.mp4/);
  assert.match(html, /data-cinema-comments="cinema-sirens"/);
});

test('Sirens uses the approved self-hosted release with sharing and discussion', () => {
  const page = 'cinema/sirens/index.html';
  const html = fs.readFileSync(path.join(repoDir, page), 'utf8');
  const video = html.indexOf('<video');
  const title = html.indexOf('<h1');
  const share = html.indexOf('data-share-film');
  const comments = html.indexOf('data-cinema-comments');
  assert.match(html, /The Sirens — Ancient Legend Unveiled/);
  assert.match(html, /assets\/originals\/sirens\/film\.mp4/);
  assert.match(html, /assets\/originals\/sirens\/poster\.webp/);
  assert.match(html, /data-cinema-comments="cinema-sirens"/);
  assert.ok(video >= 0 && video < title && title < share && share < comments, `${page}: direct viewer flow`);
  assert.doesNotMatch(html, /data-amr-engagement|engagement\.js|youtube\.com|youtu\.be/);
});

test('featured and related Cinema films expose one-click inline playback', () => {
  for (const page of ['cinema/index.html', 'cinema/enuk/index.html', 'cinema/laestrygonians/index.html', 'cinema/land-of-the-dead/index.html', 'cinema/sirens/index.html']) {
    const html = fs.readFileSync(path.join(repoDir, page), 'utf8');
    const players = [...html.matchAll(/data-cinema-player/g)];
    const playButtons = [...html.matchAll(/data-cinema-play(?:\s|>)/g)];
    assert.ok(players.length >= 2, `${page}: includes featured and inline related players`);
    assert.equal(playButtons.length, players.length, `${page}: every player has one Play control`);
    assert.match(html, /viewer-related-video[^>]*\scontrols(?:\s|>)/);
    assert.match(html, /viewer-related-video[^>]*\splaysinline(?:\s|>)/);
    assert.doesNotMatch(html, /<video\b[^>]*\sautoplay(?:\s|=|>)/);
  }
  const cinemaScript = fs.readFileSync(path.join(repoDir, 'cinema/cinema.js'), 'utf8');
  assert.match(cinemaScript, /other !== video && !other\.paused[\s\S]*other\.pause\(\)/);
});
