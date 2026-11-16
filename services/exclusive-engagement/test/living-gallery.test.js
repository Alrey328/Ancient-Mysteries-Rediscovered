import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const gallery=readFileSync(resolve(repo,'3d/index.html'),'utf8');
const viewer=readFileSync(resolve(repo,'3d/gigantes/index.html'),'utf8');
const css=readFileSync(resolve(repo,'3d/gallery.css'),'utf8');
const script=readFileSync(resolve(repo,'3d/gigantes/viewer.js'),'utf8');

test('living gallery entry and Gigantes exhibit exist without changing production home',()=>{
  assert.match(gallery,/THE LIVING/);
  assert.match(gallery,/href="\.\/gigantes\/"/);
  assert.match(viewer,/data-photo="\.\.\/\.\.\/assets\/3d\/gigantes\/canva-poster\.jpg"/);
  assert.match(viewer,/data-depth="\.\.\/\.\.\/assets\/3d\/gigantes\/wavespeed-depth\.png"/);
  assert.ok(existsSync(resolve(repo,'assets/3d/gigantes/canva-poster.jpg')));
  assert.ok(existsSync(resolve(repo,'assets/3d/gigantes/wavespeed-depth.png')));
});
test('depth viewer preserves safe navigation, fallback, and explicit user input',()=>{
  assert.match(viewer,/class="viewer-fallback"/);
  assert.match(viewer,/id="reset-view"/);
  assert.match(viewer,/id="show-original"/);
  assert.match(viewer,/id="depth-strength"/);
  assert.match(viewer,/id="phone-tilt"/);
  assert.match(script,/getContext\('webgl'/);
  assert.match(script,/webglcontextlost/);
  assert.match(script,/pointermove/);
  assert.match(script,/DeviceOrientationEvent\.requestPermission/);
  assert.match(script,/prefers-reduced-motion/);
});
test('mobile interaction is opt-in and preview pages are noindex until owner approval',()=>{
  assert.match(css,/touch-action:none/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(gallery,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(viewer,/<meta name="robots" content="noindex,nofollow">/);
  assert.doesNotMatch(viewer,/data-amr-engagement/);
});
