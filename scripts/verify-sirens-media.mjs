#!/usr/bin/env node
'use strict';
const {existsSync,readFileSync,statSync} = require('node:fs');
const {createHash} = require('node:crypto');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const media=path.join(root,'assets/originals/sirens/film.mp4');
const poster=path.join(root,'assets/originals/sirens/poster.webp');
function fail(message){ console.error('Sirens release NOT READY:',message); process.exitCode=1; }
if(!existsSync(media)) fail('Missing approved film.mp4');
else {
  const bytes=statSync(media).size;
  if(bytes!==17646122) fail('Unexpected film size: '+bytes);
  const sha=createHash('sha256').update(readFileSync(media)).digest('hex');
  if(sha!=='6c9ccc5f43c36f5e6771f77357f1e8cec2077bfe19f4daa433f07313fc9ede42') fail('Film checksum mismatch: '+sha);
}
if(!existsSync(poster)) fail('Missing official approved poster.webp');
else if(statSync(poster).size<10000) fail('Poster seems corrupt/empty');
if(!process.exitCode) console.log('Sirens release media verified (exact master + poster present).');
