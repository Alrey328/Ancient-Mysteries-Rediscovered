#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_PATH = path.join(ROOT, 'data', 'cinematic-releases.json');
const MAX_GITHUB_FILE_BYTES = 100 * 1024 * 1024;

function fail(message) { throw new Error(message); }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
function jsonScript(value) { return JSON.stringify(value).replaceAll('<', '\\u003c'); }
function urlPath(value) { return String(value).split('/').map(encodeURIComponent).join('/'); }
function localAssetUrl(asset, prefix) { return asset.source === 'repository' ? `${prefix}${urlPath(asset.path)}` : asset.url; }
function absoluteAssetUrl(manifest, asset) {
  return asset.source === 'repository' ? new URL(urlPath(asset.path), manifest.productionBaseUrl).href : asset.url;
}
function isSafeRelative(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..');
}
function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }

export function loadManifest(manifestPath = MANIFEST_PATH) {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function validateAsset(asset, kind, slug, root) {
  if (!asset || !['repository', 'r2', 'external'].includes(asset.source)) fail(`${slug}: invalid ${kind} source`);
  if (asset.source !== 'repository') {
    if (!/^https:\/\//.test(asset.url || '')) fail(`${slug}: ${kind} URL must use HTTPS`);
    return;
  }
  if (!isSafeRelative(asset.path)) fail(`${slug}: unsafe ${kind} repository path`);
  const file = path.resolve(root, asset.path);
  if (!file.startsWith(root + path.sep) || !existsSync(file)) fail(`${slug}: missing ${kind} file ${asset.path}`);
  const bytes = statSync(file).size;
  if (bytes !== asset.bytes) fail(`${slug}: ${kind} byte count is ${bytes}, expected ${asset.bytes}`);
  if (sha256(file) !== asset.sha256) fail(`${slug}: ${kind} SHA-256 does not match the manifest`);
  if (kind === 'video' && bytes > MAX_GITHUB_FILE_BYTES) {
    fail(`${slug}: repository video exceeds GitHub's 100 MiB limit; use an approved R2 or external HTTPS asset`);
  }
  const magic = readFileSync(file).subarray(0, 16);
  if (kind === 'video' && (asset.contentType !== 'video/mp4' || magic.subarray(4, 8).toString('ascii') !== 'ftyp')) fail(`${slug}: video is not a valid MP4`);
  if (kind === 'poster' && !['image/png', 'image/jpeg', 'image/webp'].includes(asset.contentType)) fail(`${slug}: unsupported poster type`);
}

export function validateManifest(manifest, root = ROOT) {
  if (manifest.version !== 1) fail('Unsupported cinematic manifest version');
  if (!/^https:\/\//.test(manifest.productionBaseUrl || '')) fail('productionBaseUrl must use HTTPS');
  if (!Array.isArray(manifest.films) || manifest.films.length === 0) fail('Manifest must contain films');
  const slugs = new Set();
  for (const film of manifest.films) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(film.slug || '')) fail(`Invalid film slug: ${film.slug}`);
    if (slugs.has(film.slug)) fail(`Duplicate film slug: ${film.slug}`);
    slugs.add(film.slug);
    for (const field of ['title', 'description', 'about', 'releaseDate', 'duration', 'durationLabel', 'discussionTerm']) {
      if (typeof film[field] !== 'string' || !film[field].trim()) fail(`${film.slug}: ${field} is required`);
    }
    if (!['prepared', 'published'].includes(film.status)) fail(`${film.slug}: status must be prepared or published`);
    if (!film.placements?.cinema && !film.placements?.exclusives && !film.placements?.homepage) fail(`${film.slug}: at least one placement is required`);
    validateAsset(film.video, 'video', film.slug, root);
    validateAsset(film.poster, 'poster', film.slug, root);
  }
  const published = manifest.films.filter(film => film.status === 'published');
  const featured = published.find(film => film.slug === manifest.homepageFeaturedSlug);
  if (!featured) fail('homepageFeaturedSlug does not identify a film');
  if (!featured.placements.homepage) fail('Homepage featured film must opt into the homepage placement');
  if (published.filter(film => film.placements.homepage).length !== 1) fail('Exactly one published film must have placements.homepage=true');
  return manifest;
}

function engagementMarkup(film) {
  if (!film.engagement?.enabled) return '';
  return `<section class="viewer-toolbar" aria-label="Film engagement"><div class="amr-engagement" data-amr-engagement data-video-id="${esc(film.engagement.id)}" data-player-id="cinema-${esc(film.slug)}-video"><button class="amr-engagement__like" type="button" data-like-button aria-pressed="false"><span aria-hidden="true">♡</span> Like <strong data-like-count>0</strong></button><span><strong data-view-count>0</strong> views</span><span class="amr-engagement__status" data-engagement-status role="status"></span></div></section>`;
}

function relatedCard(film, prefix, routePrefix = './') {
  const video = localAssetUrl(film.video, prefix);
  const poster = localAssetUrl(film.poster, prefix);
  return `<article class="viewer-related-card"><div class="viewer-related-player" data-cinema-player><video class="viewer-related-video" controls playsinline preload="metadata" poster="${esc(poster)}" aria-label="Watch ${esc(film.title)}"><source src="${esc(video)}" type="video/mp4"></video><button class="viewer-related-play" type="button" data-cinema-play aria-label="Play ${esc(film.title)} here"><span aria-hidden="true">▶</span></button><p class="viewer-play-status" data-cinema-play-status role="status" aria-live="polite"></p></div><div class="viewer-related-copy"><span>AMR Original · ${esc(film.durationLabel)}</span><h3>${esc(film.title)}</h3><p>${esc(film.description)}</p><a href="${routePrefix}${esc(film.slug)}/">Film details &amp; comments</a></div></article>`;
}

export function renderFilmPage(manifest, film, { cinemaIndex = false } = {}) {
  const prefix = cinemaIndex ? '../' : '../../';
  const css = cinemaIndex ? './cinema.css' : '../cinema.css';
  const cinemaHome = cinemaIndex ? './' : '../';
  const home = cinemaIndex ? '../' : '../../';
  const route = cinemaIndex ? 'cinema/' : `cinema/${film.slug}/`;
  const canonical = new URL(route, manifest.productionBaseUrl).href;
  const poster = localAssetUrl(film.poster, prefix);
  const video = localAssetUrl(film.video, prefix);
  const related = manifest.films.filter(item => item.placements.cinema && item.slug !== film.slug);
  const ld = { '@context': 'https://schema.org', '@type': 'VideoObject', name: film.title, description: film.description, thumbnailUrl: absoluteAssetUrl(manifest, film.poster), contentUrl: absoluteAssetUrl(manifest, film.video), url: canonical, uploadDate: film.releaseDate, duration: film.duration };
  const engagementCss = film.engagement?.enabled ? `<link rel="stylesheet" href="${prefix}exclusives/engagement.css">` : '';
  const engagementMeta = film.engagement?.enabled ? '<meta name="amr-engagement-api" content="https://amr-exclusive-engagement.belizean328.workers.dev">' : '';
  const engagementJs = film.engagement?.enabled ? `<script src="${prefix}exclusives/engagement.js"></script>` : '';
  const investigation = film.investigationPath ? `<span aria-hidden="true"> · </span><a href="${prefix}${urlPath(film.investigationPath)}">Explore the investigation</a>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Watch ${esc(film.title)} | AMR Cinema</title><meta name="description" content="${esc(film.description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="video.other"><meta property="og:title" content="Watch ${esc(film.title)} | AMR Cinema"><meta property="og:description" content="${esc(film.description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(absoluteAssetUrl(manifest, film.poster))}">${engagementMeta}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Spectral:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="${css}">${engagementCss}<script type="application/ld+json">${jsonScript(ld)}</script></head>
<body class="cinema-page viewer-page" data-cinematic-manifest-version="${manifest.version}"><a class="skip-link" href="#film-title">Skip to film</a><header class="cinema-header"><nav class="cinema-wrap cinema-nav" aria-label="Cinema navigation"><a class="cinema-brand" href="${cinemaHome}" aria-label="AMR Cinema home"><span class="cinema-brand-mark" aria-hidden="true">AMR</span><span><strong>AMR Cinema</strong><small>Ancient Mysteries Rediscovered</small></span></a><button class="cinema-menu" type="button" aria-expanded="false" aria-controls="cinema-navigation">Menu</button><ul id="cinema-navigation" class="cinema-nav-links" data-open="false"><li><a href="#recommendations">Other Films</a></li><li><a href="${home}">AMR Home</a></li></ul></nav></header>
<main class="viewer-main cinema-wrap"><section class="viewer-stage" aria-label="${esc(film.title)} film player"><div class="viewer-player-shell" data-cinema-player><video id="cinema-${esc(film.slug)}-video" class="viewer-player" controls playsinline preload="metadata" poster="${esc(poster)}" aria-label="Watch ${esc(film.title)}"><source src="${esc(video)}" type="video/mp4">Your browser does not support HTML5 video.</video><button class="viewer-play-button" type="button" data-cinema-play aria-label="Play ${esc(film.title)}"><span aria-hidden="true">▶</span></button><p class="viewer-play-status" data-cinema-play-status role="status" aria-live="polite"></p></div></section><section class="viewer-film-meta" aria-labelledby="film-title"><p class="cinema-label">AMR Original · ${esc(film.durationLabel)}</p><h1 id="film-title">${esc(film.title)}</h1><details class="viewer-about"><summary>About this film</summary><p>${esc(film.about)}</p></details></section>${engagementMarkup(film)}<section class="viewer-toolbar" aria-label="Film sharing and comments"><div class="viewer-action-group"><button class="viewer-share" type="button" data-share-film data-share-title="${esc(film.title)} | AMR Cinema" data-share-url="/${esc(route)}" aria-describedby="share-status">Share film</button><a class="viewer-comments-link" href="#comments-title">Comments</a><p class="viewer-share-status" id="share-status" role="status"></p></div></section><section class="viewer-section viewer-section--comments" aria-labelledby="comments-title"><div class="viewer-section-heading"><p>Comments &amp; discussion</p><h2 id="comments-title">Join the conversation</h2><p>Watching never requires an account. Comments and replies are hosted through GitHub Discussions and currently require a free GitHub account.</p></div><div class="viewer-comments" data-cinema-comments="${esc(film.discussionTerm)}" aria-label="Comments for ${esc(film.title)}"><p>Load the discussion when you are ready to connect to Giscus and GitHub.</p><button type="button" data-load-comments>Load comments</button></div></section><section class="viewer-section" id="recommendations" aria-labelledby="related-title"><div class="viewer-section-heading"><p>Watch another film</p><h2 id="related-title">More from AMR Cinema</h2><p>Press Play on any poster to begin the film here in one click.</p></div><div class="viewer-related-list">${related.map(item => relatedCard(item, prefix, cinemaIndex ? './' : '../')).join('')}</div></section></main>
<footer class="cinema-footer"><div class="cinema-wrap"><p>AI-assisted artistic reconstruction. Legendary narratives are not presented as verified historical events.</p><p><a href="${home}">AMR Home</a>${investigation}</p></div></footer><script src="${prefix}discussions/discussion-data.js"></script><script src="${cinemaIndex ? './cinema.js' : '../cinema.js'}"></script>${engagementJs}</body></html>
`;
}

export function renderExclusives(manifest) {
  const films = manifest.films.filter(film => film.placements.exclusives);
  const cards = films.map(film => relatedCard(film, '../', '../cinema/')).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AMR Exclusives | Original Cinematic Films</title><meta name="description" content="Watch original cinematic mysteries independently hosted by Ancient Mysteries Rediscovered."><link rel="canonical" href="${esc(new URL('exclusives/', manifest.productionBaseUrl).href)}"><link rel="stylesheet" href="../cinema/cinema.css"><style>.exclusive-heading{padding:56px 0 12px}.exclusive-heading h1{margin:.3rem 0;font-size:clamp(2.4rem,7vw,5rem)}.exclusive-heading p{max-width:50rem}.viewer-related-list{padding-bottom:70px}</style></head><body class="cinema-page" data-cinematic-manifest-version="${manifest.version}"><header class="cinema-header"><nav class="cinema-wrap cinema-nav"><a class="cinema-brand" href="../cinema/"><span class="cinema-brand-mark">AMR</span><span><strong>AMR Exclusives</strong><small>Original cinematic films</small></span></a><ul class="cinema-nav-links"><li><a href="../cinema/">Cinema</a></li><li><a href="../">AMR Home</a></li></ul></nav></header><main class="cinema-wrap"><section class="exclusive-heading"><p class="cinema-label">AMR Originals</p><h1>Exclusive films</h1><p>Independent cinematic releases from Ancient Mysteries Rediscovered. No membership is required to watch.</p></section><section class="viewer-related-list" aria-label="AMR exclusive films">${cards}</section></main><footer class="cinema-footer"><div class="cinema-wrap"><p>AI-assisted artistic reconstruction. Legendary narratives are not presented as verified historical events.</p></div></footer><script src="../cinema/cinema.js"></script></body></html>
`;
}

function publicManifest(manifest) {
  return {
    version: manifest.version,
    homepageFeaturedSlug: manifest.homepageFeaturedSlug,
    films: manifest.films.map(film => ({
      slug: film.slug, title: film.title, description: film.description, releaseDate: film.releaseDate,
      duration: film.duration, durationLabel: film.durationLabel, placements: film.placements,
      cinemaPath: `cinema/${film.slug}/`, videoUrl: absoluteAssetUrl(manifest, film.video),
      posterUrl: absoluteAssetUrl(manifest, film.poster)
    }))
  };
}

function syncHomepage(manifest) {
  const source = JSON.parse(readFileSync(path.join(ROOT, 'data', 'site-content.json'), 'utf8'));
  const film = manifest.films.find(item => item.slug === manifest.homepageFeaturedSlug);
  source.featuredOriginal = {
    enabled: true,
    livingPosterEnabled: false,
    title: film.title,
    description: film.description,
    poster: film.poster.source === 'repository' ? film.poster.path : film.poster.url,
    videoUrl: film.video.source === 'repository' ? film.video.path : film.video.url,
    watchPage: `cinema/${film.slug}/`,
    viewFrames: []
  };
  return JSON.stringify(source, null, 2) + '\n';
}

function syncSitemap(manifest) {
  let xml = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const urls = manifest.films.filter(film => film.placements.cinema).map(film => new URL(`cinema/${film.slug}/`, manifest.productionBaseUrl).href);
  for (const url of urls) {
    if (!xml.includes(`<loc>${url}</loc>`)) xml = xml.replace('</urlset>', `  <url><loc>${url}</loc></url>\n</urlset>`);
  }
  return xml;
}

export function buildOutputs(manifest) {
  validateManifest(manifest);
  const productionManifest = { ...manifest, films: manifest.films.filter(film => film.status === 'published') };
  const featured = productionManifest.films.find(film => film.slug === productionManifest.homepageFeaturedSlug);
  const outputs = new Map([
    ['data/cinematic-releases.public.json', JSON.stringify(publicManifest(productionManifest), null, 2) + '\n'],
    ['data/site-content.json', syncHomepage(productionManifest)],
    ['cinema/index.html', renderFilmPage(productionManifest, featured, { cinemaIndex: true })],
    ['exclusives/index.html', renderExclusives(productionManifest)],
    ['sitemap.xml', syncSitemap(productionManifest)]
  ]);
  for (const film of productionManifest.films.filter(item => item.placements.cinema)) {
    outputs.set(`cinema/${film.slug}/index.html`, renderFilmPage(productionManifest, film));
  }
  return outputs;
}

function atomicWrite(file, contents) {
  const temp = `${file}.amr-studio-tmp`;
  writeFileSync(temp, contents, 'utf8');
  renameSync(temp, file);
}

export function applyOutputs(outputs, { check = false } = {}) {
  const changed = [];
  for (const [relative, contents] of outputs) {
    const file = path.join(ROOT, relative);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current === contents) continue;
    changed.push(relative);
    if (!check) atomicWrite(file, contents);
  }
  if (check && changed.length) fail(`Generated cinematic files are stale: ${changed.join(', ')}. Run npm run cinema:apply.`);
  return changed;
}

export function verifyPlacement(outputs, manifest, slug) {
  const film = manifest.films.find(item => item.slug === slug);
  if (!film) fail(`Unknown film: ${slug}`);
  if (film.status === 'prepared') return true;
  const page = outputs.get(`cinema/${slug}/index.html`);
  if (film.placements.cinema && (!page || !page.includes(film.title))) fail(`${slug}: Cinema page was not generated`);
  if (film.placements.exclusives && !outputs.get('exclusives/index.html').includes(`../cinema/${slug}/`)) fail(`${slug}: Exclusives placement is missing`);
  const homepage = JSON.parse(outputs.get('data/site-content.json'));
  if (film.placements.homepage && homepage.featuredOriginal.watchPage !== `cinema/${slug}/`) fail(`${slug}: homepage placement is missing`);
  return true;
}

function main() {
  const command = process.argv[2] || 'check';
  let manifest = validateManifest(loadManifest());
  if (command === 'authorize') {
    const option = name => {
      const index = process.argv.indexOf(name);
      return index >= 0 ? process.argv[index + 1] : undefined;
    };
    const slug = option('--slug');
    const feature = option('--feature');
    const authorization = option('--authorization');
    const expectedSha = option('--manifest-sha256');
    if (!slug || authorization !== `PUBLISH ${slug}`) fail(`Authorization must exactly equal PUBLISH ${slug}`);
    if (!['yes', 'no'].includes(feature)) fail('--feature must be yes or no');
    const currentBytes = readFileSync(MANIFEST_PATH);
    const currentSha = createHash('sha256').update(currentBytes).digest('hex');
    if (!expectedSha || currentSha !== expectedSha.toLowerCase()) fail(`Manifest SHA-256 changed; expected ${expectedSha || 'a required value'}, found ${currentSha}`);
    const film = manifest.films.find(item => item.slug === slug);
    if (!film) fail(`Unknown film: ${slug}`);
    if (film.status !== 'prepared') fail(`${slug} is not awaiting owner approval`);
    film.status = 'published';
    film.placements.cinema = true;
    film.placements.exclusives = true;
    if (feature === 'yes') {
      for (const item of manifest.films) item.placements.homepage = item.slug === slug;
      manifest.homepageFeaturedSlug = slug;
    } else film.placements.homepage = false;
    atomicWrite(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    manifest = validateManifest(loadManifest());
    const changed = applyOutputs(buildOutputs(manifest));
    console.log(`Owner authorization applied for ${slug}; updated ${changed.length + 1} files.`);
    return;
  }
  const outputs = buildOutputs(manifest);
  for (const film of manifest.films.filter(item => item.status === 'published')) verifyPlacement(outputs, manifest, film.slug);
  if (command === 'apply') {
    const changed = applyOutputs(outputs);
    console.log(changed.length ? `Updated ${changed.length} generated cinematic files.` : 'Cinematic release files already current.');
  } else if (command === 'check') {
    applyOutputs(outputs, { check: true });
    console.log(`Cinematic release verified: ${manifest.films.length} films; homepage feature ${manifest.homepageFeaturedSlug}.`);
  } else if (command === 'plan') {
    console.log(JSON.stringify({ homepageFeaturedSlug: manifest.homepageFeaturedSlug, films: manifest.films.map(film => ({ slug: film.slug, placements: film.placements, videoBytes: film.video.bytes ?? null })), generatedFiles: [...outputs.keys()] }, null, 2));
  } else fail(`Unknown command: ${command}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`Cinematic release failed: ${error.message}`); process.exitCode = 1; }
}
