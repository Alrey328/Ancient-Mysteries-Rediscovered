import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const gallery=readFileSync(resolve(repo,'3d/index.html'),'utf8');
const viewer=readFileSync(resolve(repo,'3d/gigantes/index.html'),'utf8');
const sirens=readFileSync(resolve(repo,'3d/sirens/index.html'),'utf8');
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
  assert.match(script,/strictDepth16\?'webgl2':'webgl'/);
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

test('Sirens uses the exact poster and strict native 16-bit depth path',()=>{
  const poster=readFileSync(resolve(repo,'assets/3d/sirens/canva-poster.png'));
  const depth=readFileSync(resolve(repo,'assets/3d/sirens/wavespeed-depth-16bit.png'));
  assert.equal(poster.readUInt32BE(16),1024);
  assert.equal(poster.readUInt32BE(20),1536);
  assert.equal(poster[24],8);
  assert.equal(poster[25],6);
  assert.equal(depth.readUInt32BE(16),1024);
  assert.equal(depth.readUInt32BE(20),1536);
  assert.equal(depth[24],16);
  assert.equal(depth[25],0);
  assert.match(gallery,/href="\.\/sirens\/"/);
  assert.match(sirens,/data-depth-format="png16"/);
  assert.match(sirens,/wavespeed-depth-16bit\.png/);
  assert.match(sirens,/class="viewer-fallback"/);
  assert.match(sirens,/id="phone-tilt"/);
  assert.match(sirens,/id="show-original"/);
  assert.match(script,/DecompressionStream\('deflate'\)/);
  assert.match(script,/gl\.R16/);
  assert.match(script,/gl\.UNSIGNED_SHORT/);
  assert.match(script,/strictDepth16\?depth16Texture\(depth,1\):imageTexture\(depth,1\)/);
});

test('Sirens preserves restrained motion, reduced-motion support, and prelaunch isolation',()=>{
  assert.match(sirens,/data-max-shift-x="0\.045"/);
  assert.match(sirens,/data-max-shift-y="0\.028"/);
  assert.match(sirens,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(sirens,/object-fit:contain/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(sirens,/data-amr-engagement|analytics|counter|comment/i);
});
