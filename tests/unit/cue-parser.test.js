'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { cueTimeToSeconds, parseCueFile } = require('../../lib/cueParser');

// ---- cueTimeToSeconds ----

describe('cueTimeToSeconds', () => {
  it('converts 00:00:00 to 0', () => {
    assert.equal(cueTimeToSeconds('00:00:00'), 0);
  });

  it('converts whole minutes', () => {
    assert.equal(cueTimeToSeconds('02:00:00'), 120);
  });

  it('converts minutes and seconds', () => {
    assert.equal(cueTimeToSeconds('01:30:00'), 90);
  });

  it('converts frames to fractional seconds (75 fps)', () => {
    const result = cueTimeToSeconds('00:00:75');
    assert.equal(result, 1);
  });

  it('handles a realistic cue timestamp', () => {
    // 5 minutes, 23 seconds, 37 frames
    const result = cueTimeToSeconds('05:23:37');
    const expected = 5 * 60 + 23 + 37 / 75;
    assert.ok(Math.abs(result - expected) < 0.0001);
  });
});

// ---- parseCueFile ----

describe('parseCueFile', () => {
  let tmpDir;
  let cueFilePath;

  const cueSample = [
    'TITLE "Test Mix 2024"',
    'PERFORMER "DJ Test"',
    'FILE "mix.mp3" MP3',
    '  TRACK 01 AUDIO',
    '    TITLE "First Track"',
    '    PERFORMER "Artist A"',
    '    INDEX 01 00:00:00',
    '  TRACK 02 AUDIO',
    '    TITLE "Second Track"',
    '    INDEX 01 05:23:37',
    '  TRACK 03 AUDIO',
    '    TITLE "Third Track"',
    '    PERFORMER "Artist C"',
    '    INDEX 01 10:00:00',
  ].join('\n');

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cue-test-'));
    cueFilePath = path.join(tmpDir, 'test.cue');
    fs.writeFileSync(cueFilePath, cueSample, 'utf8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses album title', async () => {
    const result = await parseCueFile(cueFilePath);
    assert.equal(result.albumTitle, 'Test Mix 2024');
  });

  it('parses album performer', async () => {
    const result = await parseCueFile(cueFilePath);
    assert.equal(result.albumPerformer, 'DJ Test');
  });

  it('parses correct number of tracks', async () => {
    const result = await parseCueFile(cueFilePath);
    assert.equal(result.tracks.length, 3);
  });

  it('parses track titles', async () => {
    const result = await parseCueFile(cueFilePath);
    assert.equal(result.tracks[0].title, 'First Track');
    assert.equal(result.tracks[1].title, 'Second Track');
  });

  it('inherits album performer when track has none', async () => {
    const result = await parseCueFile(cueFilePath);
    // Track 2 has no PERFORMER, should inherit album performer
    assert.equal(result.tracks[1].performer, 'DJ Test');
  });

  it('uses track-specific performer when present', async () => {
    const result = await parseCueFile(cueFilePath);
    assert.equal(result.tracks[0].performer, 'Artist A');
    assert.equal(result.tracks[2].performer, 'Artist C');
  });

  it('calculates correct start seconds', async () => {
    const result = await parseCueFile(cueFilePath);
    assert.equal(result.tracks[0].startSeconds, 0);
    assert.equal(result.tracks[2].startSeconds, 600);
  });
});
