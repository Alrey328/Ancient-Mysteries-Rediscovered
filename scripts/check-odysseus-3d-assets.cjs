#!/usr/bin/env node
'use strict';
/**
 * AMR Odysseus 3D Gold Standard asset gate.
 * No npm dependencies; run node scripts/check-odysseus-3d-assets.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const files = [
  'assets/3d/odysseus/canva-poster.png',
  'assets/3d/odysseus/wavespeed-depth.png'
];
function dimensions(data) {
  if(data.length < 24 || data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error('Not a PNG');
  return [data.readUInt32BE(16),data.readUInt32BE(20)];
}
let failure=false;
for (const relative of files) {
  const file=path.join(root,relative);
  if(!fs.existsSync(file)) {console.error('MISSING:',relative);failure=true;continue;}
  try {
    const data=fs.readFileSync(file);
    const [width,height]=dimensions(data);
    if(width!==1264||height!==1264) throw new Error('Expected exact 1264x1264 approved image dimensions');
    console.log('PASS:',relative, width+'x'+height, data.length+' bytes',crypto.createHash('sha256').update(data).digest('hex'));
  } catch(error) {console.error('FAIL:',relative,error.message);failure=true;}
}
const html=fs.readFileSync(path.join(root,'3d/odysseus/index.html'),'utf8');
for(const relative of files) if(!html.includes('../../'+relative)) {
  console.error('FAIL: exhibit not wired to',relative);failure=true;
}
if(failure){console.error('Odysseus asset gate FAILED: do not merge/deploy');process.exitCode=1;}
else console.log('Odysseus 3D assets and paths verified. Visual QA still required.');
