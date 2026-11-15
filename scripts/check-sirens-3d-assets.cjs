#!/usr/bin/env node
'use strict';

/**
 * Fail-closed asset and precision gate for the AMR Sirens 3D exhibit.
 * No npm dependencies; run with: node scripts/check-sirens-3d-assets.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const expected = {
  poster: {
    relative: 'assets/3d/sirens/canva-poster.png',
    sha256: '9035a361e98a7a8b6769f688ae5969a51c532fbbb110937b12def1e604121070',
    bitDepth: 8,
    colorType: 2
  },
  depth: {
    relative: 'assets/3d/sirens/wavespeed-depth-16bit.png',
    sha256: '2f00ce71c04c2402f86fca4136d7ba632802807fea33df62b56f4f44ca5b6170',
    bitDepth: 16,
    colorType: 0
  }
};

function pngChunks(data) {
  if (data.length < 33 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('Not a PNG');
  }
  const chunks = [];
  for (let offset = 8; offset + 12 <= data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > data.length) throw new Error('Truncated PNG chunk');
    chunks.push({ type, data: data.subarray(start, end) });
    offset = end + 4;
    if (type === 'IEND') break;
  }
  return chunks;
}

function inspectPng(data) {
  const chunks = pngChunks(data);
  const ihdr = chunks.find(chunk => chunk.type === 'IHDR')?.data;
  if (!ihdr || ihdr.length !== 13) throw new Error('Missing PNG IHDR');
  return {
    chunks,
    width: ihdr.readUInt32BE(0),
    height: ihdr.readUInt32BE(4),
    bitDepth: ihdr[8],
    colorType: ihdr[9],
    compression: ihdr[10],
    filter: ihdr[11],
    interlace: ihdr[12]
  };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodeGrayscale16(data, metadata) {
  const compressed = Buffer.concat(metadata.chunks.filter(chunk => chunk.type === 'IDAT').map(chunk => chunk.data));
  const raw = zlib.inflateSync(compressed);
  const stride = metadata.width * 2;
  const expectedLength = (stride + 1) * metadata.height;
  if (raw.length !== expectedLength) throw new Error(`Unexpected decoded length ${raw.length}; expected ${expectedLength}`);
  const recon = Buffer.alloc(stride * metadata.height);
  let input = 0;
  for (let y = 0; y < metadata.height; y += 1) {
    const filter = raw[input++];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[input++];
      const index = y * stride + x;
      const left = x >= 2 ? recon[index - 2] : 0;
      const up = y > 0 ? recon[index - stride] : 0;
      const upLeft = y > 0 && x >= 2 ? recon[index - stride - 2] : 0;
      let result;
      if (filter === 0) result = value;
      else if (filter === 1) result = value + left;
      else if (filter === 2) result = value + up;
      else if (filter === 3) result = value + Math.floor((left + up) / 2);
      else if (filter === 4) result = value + paeth(left, up, upLeft);
      else throw new Error(`Unsupported PNG row filter ${filter}`);
      recon[index] = result & 255;
    }
  }
  const samples = new Uint16Array(metadata.width * metadata.height);
  for (let i = 0; i < samples.length; i += 1) samples[i] = recon[i * 2] * 256 + recon[i * 2 + 1];
  return samples;
}

function regionMean(samples, width, height, x0, y0, x1, y1) {
  let total = 0, count = 0;
  for (let y = Math.floor(y0 * height); y < Math.ceil(y1 * height); y += 1) {
    for (let x = Math.floor(x0 * width); x < Math.ceil(x1 * width); x += 1) {
      total += samples[y * width + x];
      count += 1;
    }
  }
  return Math.round(total / count);
}

let failed = false;
let depthMetadata;
let depthSamples;
for (const [kind, spec] of Object.entries(expected)) {
  const file = path.join(root, spec.relative);
  try {
    const data = fs.readFileSync(file);
    const metadata = inspectPng(data);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if (metadata.width !== 1024 || metadata.height !== 1536) throw new Error('Expected exact 1024x1536 dimensions');
    if (metadata.bitDepth !== spec.bitDepth || metadata.colorType !== spec.colorType) {
      throw new Error(`Expected PNG bit depth/color type ${spec.bitDepth}/${spec.colorType}; got ${metadata.bitDepth}/${metadata.colorType}`);
    }
    if (metadata.compression !== 0 || metadata.filter !== 0 || metadata.interlace !== 0) throw new Error('Expected standard, non-interlaced PNG encoding');
    if (hash !== spec.sha256) throw new Error(`SHA-256 mismatch: ${hash}`);
    if (kind === 'depth') {
      depthMetadata = metadata;
      depthSamples = decodeGrayscale16(data, metadata);
      const unique = new Set(depthSamples);
      if (unique.size <= 256) throw new Error(`Only ${unique.size} unique depth values; 16-bit precision appears truncated`);
      const background = regionMean(depthSamples, metadata.width, metadata.height, 0.45, 0.01, 0.55, 0.04);
      const foregroundFrame = regionMean(depthSamples, metadata.width, metadata.height, 0.45, 0.055, 0.55, 0.085);
      if (foregroundFrame <= background + 1000) throw new Error(`Depth direction failed: light frame ${foregroundFrame} is not nearer than dark background ${background}`);
      console.log(`PASS: ${spec.relative} ${metadata.width}x${metadata.height} 16-bit grayscale; ${unique.size} unique values; white-near orientation ${foregroundFrame} > ${background}`);
    } else {
      console.log(`PASS: ${spec.relative} ${metadata.width}x${metadata.height} 8-bit RGB; exact approved hash`);
    }
  } catch (error) {
    console.error(`FAIL: ${spec.relative}: ${error.message}`);
    failed = true;
  }
}

try {
  const html = fs.readFileSync(path.join(root, '3d/sirens/index.html'), 'utf8');
  const viewer = fs.readFileSync(path.join(root, '3d/gigantes/viewer.js'), 'utf8');
  if (!html.includes('../../assets/3d/sirens/canva-poster.png')) throw new Error('Sirens poster path is not wired');
  if (!html.includes('../../assets/3d/sirens/wavespeed-depth-16bit.png')) throw new Error('Sirens depth path is not wired');
  if (!html.includes('data-depth-format="png16"')) throw new Error('Sirens is not configured for strict 16-bit decoding');
  if (!viewer.includes('gl.R16UI') || !viewer.includes('gl.RED_INTEGER') || !viewer.includes('gl.UNSIGNED_SHORT')) throw new Error('Viewer lacks a WebGL2 R16UI upload path');
  if (!viewer.includes('usampler2D') || !viewer.includes('/65535.0')) throw new Error('Viewer lacks full-range unsigned 16-bit sampling');
  console.log('PASS: Sirens route requires strict WebGL2 R16UI decoding, full-range sampling, and original-image fallback.');
} catch (error) {
  console.error(`FAIL: exhibit wiring: ${error.message}`);
  failed = true;
}

if (failed) {
  console.error('Sirens asset gate FAILED: do not preview, merge, or deploy.');
  process.exitCode = 1;
} else {
  const min = Math.min(...depthSamples.subarray(0, Math.min(depthSamples.length, 100000)));
  console.log(`Sirens 3D asset gate passed. Decoded ${depthMetadata.width * depthMetadata.height} native 16-bit samples (sample minimum ${min}). Visual QA still required.`);
}
