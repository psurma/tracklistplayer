'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const { BoundedMap, resolveAndValidate } = require('../lib/helpers');
const { readLibrary } = require('./library');
const { runWithTimeout } = require('../lib/spawnUtil');
const { logError } = require('../lib/logger');

// Waveform cache (in-memory, keyed by absolute mp3 path)
const waveformCache = new BoundedMap(200);

// Shared helper: decode audio via ffmpeg, bucket into amplitude arrays, cache result.
async function getOrComputeWaveform(filePath, bucketMs) {
  const cacheKey = `${filePath}@${bucketMs}`;
  if (waveformCache.has(cacheKey)) return waveformCache.get(cacheKey);

  const SAMPLE_RATE = 2000;
  const SAMPLES_PER_BUCKET = Math.round(SAMPLE_RATE * bucketMs / 1000);

  // 5-min wall-clock cap on ffmpeg so a stalled file (network drive, locked
  // file) cannot pin a worker indefinitely.
  const ff = await runWithTimeout('ffmpeg', [
    '-i', filePath,
    '-ac', '1', '-ar', String(SAMPLE_RATE),
    '-f', 'f32le', 'pipe:1',
  ], { timeoutMs: 5 * 60 * 1000 });
  if (ff.code !== 0) throw new Error(ff.killed ? 'ffmpeg decode timeout' : 'ffmpeg decode failed');

  const raw = ff.stdout;
  const numSamples = Math.floor(raw.length / 4);
  const floats = new Float32Array(raw.buffer, raw.byteOffset, numSamples);
  const duration = numSamples / SAMPLE_RATE;
  const numBuckets = Math.ceil(numSamples / SAMPLES_PER_BUCKET);

  const rPeaks = new Float32Array(numBuckets);
  const rBass  = new Float32Array(numBuckets);
  const rMids  = new Float32Array(numBuckets);
  const rHighs = new Float32Array(numBuckets);

  const A_BASS = 0.08;
  const A_MID  = 0.40;
  let loBass = 0, loMid = 0;

  for (let b = 0; b < numBuckets; b++) {
    const s = b * SAMPLES_PER_BUCKET;
    const e = Math.min(s + SAMPLES_PER_BUCKET, numSamples);
    let peak = 0, bSum = 0, mSum = 0, hSum = 0;
    for (let i = s; i < e; i++) {
      const x = Math.abs(floats[i]);
      if (x > peak) peak = x;
      loBass = A_BASS * x + (1 - A_BASS) * loBass;
      loMid  = A_MID  * x + (1 - A_MID)  * loMid;
      bSum += loBass;
      mSum += Math.max(0, loMid - loBass);
      hSum += Math.max(0, x - loMid);
    }
    const n = e - s;
    rPeaks[b] = peak;
    rBass[b]  = bSum / n;
    rMids[b]  = mSum / n;
    rHighs[b] = hSum / n;
  }

  const sorted = Float32Array.from(rPeaks).sort();
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const peakScale = 254 / p95;

  function bandScale(arr) {
    const s = Float32Array.from(arr).sort();
    const p = s[Math.floor(s.length * 0.95)] || 1;
    return 254 / p;
  }
  const bassScale  = bandScale(rBass);
  const midsScale  = bandScale(rMids);
  const highsScale = bandScale(rHighs);

  const peaks = new Uint8Array(numBuckets);
  const bass  = new Uint8Array(numBuckets);
  const mids  = new Uint8Array(numBuckets);
  const highs = new Uint8Array(numBuckets);
  for (let b = 0; b < numBuckets; b++) {
    peaks[b] = Math.min(255, Math.round(rPeaks[b] * peakScale));
    bass[b]  = Math.min(255, Math.round(rBass[b]  * bassScale));
    mids[b]  = Math.min(255, Math.round(rMids[b]  * midsScale));
    highs[b] = Math.min(255, Math.round(rHighs[b] * highsScale));
  }

  const result = {
    duration,
    numBuckets,
    bucketSecs: SAMPLES_PER_BUCKET / SAMPLE_RATE,
    peaks: Buffer.from(peaks).toString('base64'),
    bass:  Buffer.from(bass).toString('base64'),
    mids:  Buffer.from(mids).toString('base64'),
    highs: Buffer.from(highs).toString('base64'),
  };
  waveformCache.set(cacheKey, result);
  return result;
}

// GET /api/waveform?path=<absolute mp3 path>
router.get('/api/waveform', async (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const bucketMs = Math.max(25, Math.min(200, parseInt(req.query.bucketMs, 10) || 100));

  try { await fs.promises.access(filePath); }
  catch (_) { return res.status(404).json({ error: 'File not found' }); }

  try {
    res.json(await getOrComputeWaveform(filePath, bucketMs));
  } catch (err) {
    logError('waveform', err);
    res.status(500).json({ error: 'Waveform analysis failed' });
  }
});

// GET /api/detect-transitions?path=&count=&bucketMs=
router.get('/api/detect-transitions', async (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const count    = parseInt(req.query.count, 10) || 0;
  const bucketMs = Math.max(25, Math.min(200, parseInt(req.query.bucketMs, 10) || 100));

  try { await fs.promises.access(filePath); }
  catch (_) { return res.status(404).json({ error: 'File not found' }); }

  try {
    const wf = await getOrComputeWaveform(filePath, bucketMs);
    const peaksRaw = Buffer.from(wf.peaks, 'base64');
    const peaks    = new Uint8Array(peaksRaw);
    const n        = peaks.length;

    const windowBuckets  = Math.max(3, Math.round(20000 / bucketMs));
    const half           = Math.floor(windowBuckets / 2);
    const prefix         = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + peaks[i];

    const smoothed       = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const lo     = Math.max(0, i - half);
      const hi     = Math.min(n - 1, i + half);
      smoothed[i]  = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
    }

    const sPrefix = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) sPrefix[i + 1] = sPrefix[i] + smoothed[i];

    const skipBuckets    = Math.round(60000  / bucketMs);
    const contextBuckets = Math.round(120000 / bucketMs);

    const allMinima = [];
    for (let i = skipBuckets + 1; i < n - skipBuckets - 1; i++) {
      if (smoothed[i] > smoothed[i - 1] || smoothed[i] > smoothed[i + 1]) continue;

      const ctxLo   = Math.max(0, i - contextBuckets);
      const ctxHi   = Math.min(n - 1, i + contextBuckets);
      const localAvg = (sPrefix[ctxHi + 1] - sPrefix[ctxLo]) / (ctxHi - ctxLo + 1);
      const confidence = localAvg > 0 ? Math.max(0, 1 - smoothed[i] / localAvg) : 0;
      allMinima.push({ i, confidence });
    }

    const minSep  = Math.round(180000 / bucketMs);
    const wantN   = count > 0 ? count - 1 : allMinima.length;
    const byCconf = allMinima.slice().sort((a, b) => b.confidence - a.confidence);
    const selected = [];
    for (const cand of byCconf) {
      if (selected.length >= wantN) break;
      if (selected.some((s) => Math.abs(s.i - cand.i) < minSep)) continue;
      selected.push(cand);
    }
    selected.sort((a, b) => a.i - b.i);

    const bucketSecs  = bucketMs / 1000;
    const transitions = [
      { index: 0, seconds: 0, confidence: 1.0 },
      ...selected.map((c, idx) => ({
        index:      idx + 1,
        seconds:    Math.round(c.i * bucketSecs),
        confidence: Math.round(c.confidence * 100) / 100,
      })),
    ];

    res.json({ duration: Math.round(wf.duration), transitions });
  } catch (err) {
    logError('detect', err);
    res.status(500).json({ error: 'Transition detection failed' });
  }
});

// GET /api/sync-test-waveform
router.get('/api/sync-test-waveform', (req, res) => {
  const bucketMs   = Math.max(25, Math.min(200, parseInt(req.query.bucketMs, 10) || 100));
  const bucketSecs = bucketMs / 1000;
  const DURATION   = 120;
  const numBuckets = Math.ceil(DURATION / bucketSecs);

  const peaks = new Uint8Array(numBuckets);
  const bass  = new Uint8Array(numBuckets);
  const mids  = new Uint8Array(numBuckets);
  const highs = new Uint8Array(numBuckets);

  for (let b = 0; b < numBuckets; b++) {
    const t = b * bucketSecs;
    const nearestSec = Math.round(t);
    const dist = Math.abs(t - nearestSec);
    if (dist < 0.08) {
      const amp = Math.round(220 * (1 - dist / 0.08));
      peaks[b] = amp;
      highs[b] = amp;
    }
    const secNum = Math.floor(t);
    const offsetInSec = t - secNum;
    if (offsetInSec >= 0.08 && offsetInSec < 0.12) {
      const amp = 180;
      peaks[b] = Math.max(peaks[b], amp);
      const frac = Math.min(1, secNum / 100);
      bass[b]  = Math.round(amp * (1 - frac));
      mids[b]  = Math.round(amp * Math.sin(Math.PI * frac));
      highs[b] = Math.max(highs[b], Math.round(amp * frac));
    }
  }

  const toB64 = (arr) => Buffer.from(arr).toString('base64');
  res.json({
    duration:   DURATION,
    numBuckets,
    bucketSecs,
    peaks: toB64(peaks),
    bass:  toB64(bass),
    mids:  toB64(mids),
    highs: toB64(highs),
  });
});

// GET /api/sync-test
router.get('/api/sync-test', (req, res) => {
  const RATE      = 44100;
  const DURATION  = 120;
  const numSamples = RATE * DURATION;
  const pcm = Buffer.alloc(numSamples * 2);

  for (let s = 0; s < DURATION; s++) {
    const markerSamples = Math.round(0.08 * RATE);
    for (let i = 0; i < markerSamples; i++) {
      const n = s * RATE + i;
      const v = Math.round(28000 * Math.sin(2 * Math.PI * 1000 * n / RATE));
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, v)), n * 2);
    }
    const freq = Math.min(8000, (s + 1) * 80);
    const numToneSamples = Math.round(0.04 * RATE);
    const toneStart = s * RATE + markerSamples;
    for (let i = 0; i < numToneSamples; i++) {
      const n = toneStart + i;
      const v = Math.round(20000 * Math.sin(2 * Math.PI * freq * n / RATE));
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, v)), n * 2);
    }
  }

  const dataLen = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLen, 40);

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Content-Length', header.length + dataLen);
  res.setHeader('Content-Disposition', 'inline; filename="sync-test.wav"');
  res.end(Buffer.concat([header, pcm]));
});

module.exports = router;
