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
  {relative:'assets/3d/odysseus/canva-poster.png',sha256:'81d46b62c8f99e18b81a2c3e1860b62fcf0c5a2bbe4405f976ede5c2e6c9c72f',bitDepth:8,colorType:2},
  {relative:'assets/3d/odysseus/wavespeed-depth.png',sha256:'8297ae4ab1e97bb08a229e6c5cd7c144539fc84b55e791ace666d7132f05b5d4',bitDepth:8,colorType:6}
];
function metadata(data) {
  if(data.length < 29 || data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error('Not a PNG');
  return {width:data.readUInt32BE(16),height:data.readUInt32BE(20),bitDepth:data[24],colorType:data[25],interlace:data[28]};
}
let failure=false;
for (const expected of files) {
  const file=path.join(root,expected.relative);
  if(!fs.existsSync(file)) {console.error('MISSING:',expected.relative);failure=true;continue;}
  try {
    const data=fs.readFileSync(file);
    const png=metadata(data);
    const hash=crypto.createHash('sha256').update(data).digest('hex');
    if(png.width!==1264||png.height!==1264) throw new Error('Expected exact 1264x1264 approved image dimensions');
    if(png.bitDepth!==expected.bitDepth||png.colorType!==expected.colorType||png.interlace!==0) throw new Error(`Unexpected PNG encoding ${png.bitDepth}/${png.colorType}/${png.interlace}`);
    if(hash!==expected.sha256) throw new Error(`SHA-256 mismatch: ${hash}`);
    console.log('PASS:',expected.relative,png.width+'x'+png.height,data.length+' bytes',hash);
  } catch(error) {console.error('FAIL:',expected.relative,error.message);failure=true;}
}
const html=fs.readFileSync(path.join(root,'3d/odysseus/index.html'),'utf8');
for(const expected of files) if(!html.includes('../../'+expected.relative)) {
  console.error('FAIL: exhibit not wired to',expected.relative);failure=true;
}
const gallery=fs.readFileSync(path.join(root,'3d/index.html'),'utf8');
if(!gallery.includes('href="./odysseus/"')||!gallery.includes('../assets/3d/odysseus/canva-poster.png')) {console.error('FAIL: Odysseus gallery card is missing');failure=true;}
if(html.includes('depth-strength')||gallery.includes('depth-strength')) {console.error('FAIL: visitor-facing depth control remains');failure=true;}
if(failure){console.error('Odysseus asset gate FAILED: do not merge/deploy');process.exitCode=1;}
else console.log('Odysseus 3D assets and paths verified. Visual QA still required.');
