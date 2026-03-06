'use strict';

const { test, expect } = require('@playwright/test');

// ── Minimal silent WAV (10 seconds, 8000Hz, mono, 8-bit) ────────────────────
function makeSilentWav(durationSecs = 10) {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSecs;
  const buf = Buffer.alloc(44 + numSamples);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + numSamples, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);         // PCM
  buf.writeUInt16LE(1, 22);         // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(numSamples, 40);
  buf.fill(128, 44);

  return buf;
}

const WAV_BUF = makeSilentWav(10);

const FAKE_DISCS = [
  {
    id: 0,
    mp3Path: '/fake/mix.mp3',
    mp3File: 'mix.mp3',
    cueFile: 'mix.cue',
    albumTitle: 'Test Mix',
    albumPerformer: 'Various',
    tracks: [
      { track: 1, title: 'First Song',  performer: 'Artist A', startSeconds: 0 },
      { track: 2, title: 'Second Song', performer: 'Artist B', startSeconds: 3 },
      { track: 3, title: 'Third Song',  performer: 'Artist C', startSeconds: 7 },
    ],
  },
];

async function setupPage(page) {
  await page.route('/api/config', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dir: '' }) })
  );
  await page.route('/api/scan**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ dir: '/fake', discs: FAKE_DISCS }),
    })
  );
  await page.route('/file**', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: WAV_BUF })
  );

  await page.goto('/');
  await page.fill('#dir-input', '/fake/music');
  await page.click('#dir-load-btn');
  await page.waitForSelector('.track-item');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('track list renders correct number of tracks', async ({ page }) => {
  await setupPage(page);
  await expect(page.locator('.track-item')).toHaveCount(3);
});

test('clicking a track updates now-playing title', async ({ page }) => {
  await setupPage(page);
  await page.click('.track-item[data-track="1"]');
  await expect(page.locator('#np-title')).toHaveText('Second Song', { timeout: 3000 });
});

test('clicking a track shows Spotify button with correct search', async ({ page }) => {
  await setupPage(page);
  await page.click('.track-item[data-track="0"]');
  const btn = page.locator('#spotify-btn');
  await expect(btn).toBeVisible({ timeout: 3000 });
  const href = await btn.getAttribute('href');
  expect(href).toContain('spotify.com/search');
  expect(href).toContain('Artist%20A');
});

test('scrubber does not freeze: state.seeking resets after change event', async ({ page }) => {
  await setupPage(page);
  await page.click('.track-item[data-track="0"]');
  await page.waitForTimeout(300);

  // Simulate full scrub cycle: mousedown → input → change
  await page.locator('#seek-bar').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.value = '50';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Inject a timeupdate — if seeking is stuck true, timeCurrent won't update
  await page.evaluate(() => {
    const audio = document.getElementById('audio');
    Object.defineProperty(audio, 'currentTime', { get: () => 4, configurable: true });
    Object.defineProperty(audio, 'duration',    { get: () => 10, configurable: true });
    audio.dispatchEvent(new Event('timeupdate'));
  });

  await expect(page.locator('#time-current')).toHaveText('0:04', { timeout: 2000 });
});

test('scrubber does not freeze: state.seeking resets via document mouseup (mouse released outside window)', async ({ page }) => {
  await setupPage(page);
  await page.click('.track-item[data-track="0"]');
  await page.waitForTimeout(300);

  // mousedown only — no change event (simulates releasing mouse outside browser)
  await page.locator('#seek-bar').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });

  // Release on document (not on seek bar)
  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  // Inject timeupdate — should update because seeking is now false
  await page.evaluate(() => {
    const audio = document.getElementById('audio');
    Object.defineProperty(audio, 'currentTime', { get: () => 2, configurable: true });
    Object.defineProperty(audio, 'duration',    { get: () => 10, configurable: true });
    audio.dispatchEvent(new Event('timeupdate'));
  });

  await expect(page.locator('#time-current')).toHaveText('0:02', { timeout: 2000 });
});
