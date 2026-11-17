import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOutputs, loadManifest, validateManifest, verifyPlacement } from '../scripts/cinematic-release.mjs';

test('the canonical manifest preserves every published cinematic', () => {
  const manifest = validateManifest(loadManifest());
  assert.deepEqual(manifest.films.map(film => film.slug), [
    'sirens', 'land-of-the-dead', 'laestrygonians', 'enuk'
  ]);
  for (const film of manifest.films) {
    assert.equal(film.status, 'published');
    assert.equal(film.placements.cinema, true);
    assert.equal(film.placements.exclusives, true);
  }
});

test('Sirens renders into Cinema, Exclusives, homepage and the public manifest', () => {
  const manifest = validateManifest(loadManifest());
  const outputs = buildOutputs(manifest);
  assert.equal(verifyPlacement(outputs, manifest, 'sirens'), true);
  assert.match(outputs.get('cinema/sirens/index.html'), /cinema-sirens/);
  assert.match(outputs.get('cinema/sirens/index.html'), /assets\/originals\/sirens\/film\.mp4/);
  assert.match(outputs.get('exclusives/index.html'), /\.\.\/cinema\/sirens\//);
  const homepage = JSON.parse(outputs.get('data/site-content.json'));
  assert.equal(homepage.featuredOriginal.watchPage, 'cinema/sirens/');
  assert.equal(homepage.featuredOriginal.videoUrl, 'assets/originals/sirens/film.mp4');
  const publicManifest = JSON.parse(outputs.get('data/cinematic-releases.public.json'));
  assert.equal(publicManifest.homepageFeaturedSlug, 'sirens');
  assert.equal(publicManifest.films.length, 4);
});

test('the owner can choose a different homepage cinematic without changing templates', () => {
  const manifest = structuredClone(loadManifest());
  for (const film of manifest.films) film.placements.homepage = film.slug === 'land-of-the-dead';
  manifest.homepageFeaturedSlug = 'land-of-the-dead';
  validateManifest(manifest);
  const outputs = buildOutputs(manifest);
  const homepage = JSON.parse(outputs.get('data/site-content.json'));
  assert.equal(homepage.featuredOriginal.watchPage, 'cinema/land-of-the-dead/');
  assert.match(outputs.get('cinema/index.html'), /Odysseus — The Land of the Dead/);
});

test('ambiguous homepage ownership is rejected before files change', () => {
  const manifest = structuredClone(loadManifest());
  manifest.films.find(film => film.slug === 'land-of-the-dead').placements.homepage = true;
  assert.throws(() => validateManifest(manifest), /Exactly one published film/);
});

test('prepared releases remain invisible until explicit owner authorization', () => {
  const manifest = structuredClone(loadManifest());
  const prepared = structuredClone(manifest.films[0]);
  prepared.slug = 'prepared-regression';
  prepared.title = 'Prepared Regression';
  prepared.status = 'prepared';
  prepared.placements.homepage = true;
  manifest.films.unshift(prepared);
  validateManifest(manifest);
  const outputs = buildOutputs(manifest);
  assert.equal(outputs.has('cinema/prepared-regression/index.html'), false);
  assert.doesNotMatch(outputs.get('exclusives/index.html'), /Prepared Regression/);
  assert.doesNotMatch(outputs.get('data/cinematic-releases.public.json'), /prepared-regression/);
});
