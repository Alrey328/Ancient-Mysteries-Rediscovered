#!/usr/bin/env node
'use strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
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
else {
  const posterBytes=readFileSync(poster);
  if(posterBytes.length<25) fail('Poster seems corrupt/empty');
  else if(posterBytes.subarray(0,4).toString('ascii')!=='RIFF' || posterBytes.subarray(8,12).toString('ascii')!=='WEBP') fail('Poster is not a WebP file');
  else if(posterBytes.subarray(12,16).toString('ascii')!=='VP8L') fail('Poster is not the approved lossless WebP derivative');
  else {
    const dimensions=posterBytes.readUInt32LE(21);
    const width=(dimensions&0x3fff)+1;
    const height=((dimensions>>>14)&0x3fff)+1;
    if(width!==981 || height!==1602) fail(`Unexpected poster dimensions: ${width}x${height}`);
  }
}
if(!process.exitCode) console.log('Sirens release media verified (exact master + poster present).');
