import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const sharedInvestigations = [
  'giant-of-kandahar', 'gilgamesh', 'land-of-the-dead', 'maximinus-thrax',
  'og-of-bashan', 'rephaim', 'si-te-cah', 'the-man-who-made-a-god-bleed'
];
const customInvestigations = [
  ['anakim', 'anakim.css'],
  ['goliath-of-gath', 'goliath.css'],
  ['hundred-handed-giants', 'hecatoncheires.css'],
  ['sa-nakht', 'sa-nakht.css'],
  ['talos', 'talos.css']
];
const marker = 'AMR remaining investigations readability V2';

test('eight shared-style investigations retain their navigation and one legibility treatment', () => {
  const css = read('mysteries/investigation-styles.css');
  const last = css.slice(css.lastIndexOf(marker));
  assert.ok(css.includes(marker));
  assert.match(last, /header\.wrap \.nav-links a/);
  assert.match(last, /nav\.breadcrumbs a/);
  assert.match(last, /min-height:48px/);
  for (const slug of sharedInvestigations) {
    const html = read(`mysteries/${slug}/index.html`);
    assert.match(html, /investigation-styles\.css/);
    assert.match(html, /class="nav-links"/);
    assert.match(html, /class="breadcrumbs wrap"/);
  }
});

test('five custom investigations preserve their own styles while improving tab visibility', () => {
  for (const [slug, cssName] of customInvestigations) {
    const html = read(`mysteries/${slug}/index.html`);
    const css = read(`mysteries/${slug}/${cssName}`);
    const last = css.slice(css.lastIndexOf(marker));
    assert.match(html, new RegExp(cssName.replace('.', '\\.')));
    assert.ok(last.includes('.site-'), `${slug}: dedicated nav still styled`);
    assert.match(last, /min-height:(?:44|46|48)px/, `${slug}: visible tap targets`);
    assert.match(last, /focus-visible/, `${slug}: keyboard focus remains visible`);
    assert.match(html, /href="#sources"/);
  }
});

test('mobile navigation retains access to all investigation targets', () => {
  for (const slug of ['anakim', 'hundred-handed-giants']) {
    const cssName = slug === 'anakim' ? 'anakim.css' : 'hecatoncheires.css';
    const css = read(`mysteries/${slug}/${cssName}`);
    const last = css.slice(css.lastIndexOf(marker));
    assert.match(last, /nav a:not\(\.nav-watch\)\s*\{\s*display:inline-flex;/);
    assert.match(last, /overflow-x:auto/);
  }
  for (const slug of ['goliath-of-gath', 'sa-nakht', 'talos']) {
    const html = read(`mysteries/${slug}/index.html`);
    assert.match(html, /href="#evidence"/);
    assert.match(html, /href="#sources"/);
  }
});
