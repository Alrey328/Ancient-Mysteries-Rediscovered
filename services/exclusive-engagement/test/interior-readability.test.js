import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('interior page navigation uses legible labels and touch targets', () => {
  const cases = [
    ['cinema/cinema.css', '.cinema-nav-links a'],
    ['assets/css/amr-premieres.css', '.youtube-library-page .library-nav-links a'],
    ['exclusives/style.css', 'header nav > a'],
    ['mysteries/giants-after-flood-001/giants-after-flood.css', '.site-nav .nav-track a'],
    ['mysteries/book-of-giants/book-of-giants.css', '.site-nav .nav-track a']
  ];
  for (const [file, selector] of cases) {
    const css = read(file);
    const addition = css.slice(css.lastIndexOf('AMR interior readability V2'));
    assert.ok(addition.includes(selector), `${file} has legibility styling for ${selector}`);
    assert.match(addition, /min-height:\s*(?:44|48)px/, `${file} includes accessible navigation targets`);
  }
});

test('Cinema and YouTube branding subtitles remain visible on narrow screens', () => {
  const cinema = read('cinema/cinema.css');
  const library = read('assets/css/amr-premieres.css');
  assert.match(cinema.slice(cinema.lastIndexOf('AMR interior readability V2')), /\.cinema-brand small[^}]*font-size:\s*\.67rem/);
  assert.match(library.slice(library.lastIndexOf('AMR interior readability V2')), /\.library-brand-subtitle[^}]*font-size:\s*\.7rem/);
});

test('investigation navigation stays horizontally scrollable and retains existing chapter targets', () => {
  for (const [page, cssFile] of [
    ['mysteries/giants-after-flood-001/index.html', 'mysteries/giants-after-flood-001/giants-after-flood.css'],
    ['mysteries/book-of-giants/index.html', 'mysteries/book-of-giants/book-of-giants.css']
  ]) {
    const html = read(page);
    const css = read(cssFile);
    assert.match(html, /class="nav-track"/);
    assert.match(html, /href="#sources"/);
    assert.match(css, /\.nav-track\{[^}]*overflow-x:auto/);
    assert.match(css.slice(css.lastIndexOf('AMR interior readability V2')), /\.site-nav \.nav-track a/);
  }
});
