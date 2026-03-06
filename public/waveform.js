'use strict';

// ── WaveformRenderer ──────────────────────────────────────────────────────────
// Renders a full-track overview canvas and a 30-second zoom canvas.
// Data comes from /api/waveform (Uint8 arrays, base64-encoded).

class WaveformRenderer {
  constructor(overviewCanvas, zoomCanvas, onSeek) {
    this.ov = overviewCanvas;
    this.zm = zoomCanvas;
    this.onSeek = onSeek;

    this.peaks = null;
    this.bass  = null;
    this.mids  = null;
    this.highs = null;
    this.numBuckets = 0;
    this.bucketSecs = 0.1;
    this.duration   = 0;
    this.tracks     = [];
    this.currentTime = 0;
    this._raf = null;

    this._bindEvents();
  }

  // Load waveform from API response + CUE track list
  load(apiData, tracks) {
    const dec = (b64) => {
      const bin = atob(b64);
      const u8  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    };
    this.peaks = dec(apiData.peaks);
    this.bass  = dec(apiData.bass);
    this.mids  = dec(apiData.mids);
    this.highs = dec(apiData.highs);
    this.numBuckets = apiData.numBuckets;
    this.bucketSecs = apiData.bucketSecs;
    this.duration   = apiData.duration;
    this.tracks     = tracks || [];
    this._ovTime    = -999; // force full overview redraw on first tick
    this._invalidateCache();
    this._renderOverview();
  }

  // Called every animation frame by app.js — reads audio time directly for 60 fps scrolling
  tick(currentTime, liveDuration) {
    this.currentTime = currentTime;
    if (liveDuration > 0) this.duration = liveDuration;
    if (!this.peaks) return;
    this._renderZoom();
    // Overview is cheaper — only redraw when playhead has moved noticeably
    if (Math.abs(currentTime - this._ovTime) > 1) {
      this._ovTime = currentTime;
      this._renderOverview();
    }
  }

  clear() {
    this.peaks = null;
    this._ovTime = -999;
    this._clearCanvas(this.ov);
    this._clearCanvas(this.zm);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  // Cache canvas physical size; only recalculate on resize
  _setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    if (!canvas._wfCache) canvas._wfCache = {};
    const cache = canvas._wfCache;
    if (!cache.valid) {
      const rect  = canvas.getBoundingClientRect();
      const W     = Math.round(rect.width);
      const H     = Math.round(rect.height);
      const pw    = Math.round(W * dpr);
      const ph    = Math.round(H * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width  = pw;
        canvas.height = ph;
      }
      cache.W = W; cache.H = H; cache.valid = true;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W: cache.W, H: cache.H };
  }

  _invalidateCache() {
    if (this.ov._wfCache) this.ov._wfCache.valid = false;
    if (this.zm._wfCache) this.zm._wfCache.valid = false;
  }

  _clearCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }

  // bass/mid/high are 0-255 → HSL colour: warm hues for bass, cool/cyan for treble
  _color(b, m, h) {
    const peak = Math.max(b, m, h, 1);
    // warmth: 1 = bass-dominated, 0 = treble-dominated
    const warmth = (b * 2 + m) / (b * 2 + m + h * 2 + 1);
    // hue: 0 = red (bass), 200 = cyan (treble)
    const hue = Math.round((1 - warmth) * 200);
    const lit = Math.round(15 + (peak / 255) * 45); // 15–60 %
    return `hsl(${hue},80%,${lit}%)`;
  }

  _renderOverview() {
    const { ctx, W, H } = this._setup(this.ov);
    const { peaks, bass, mids, highs, numBuckets, bucketSecs } = this;
    // Use the decoded duration (numBuckets * bucketSecs) as the single time reference
    // so waveform bars, playhead, and track markers all share the same scale.
    const decodedDuration = numBuckets * bucketSecs;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0a0a';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const bpp = numBuckets / W; // buckets per pixel

    for (let x = 0; x < W; x++) {
      const b0 = Math.floor(x * bpp);
      const b1 = Math.min(Math.ceil((x + 1) * bpp), numBuckets);
      if (b0 >= b1) continue;

      let pMax = 0, bSum = 0, mSum = 0, hSum = 0;
      for (let b = b0; b < b1; b++) {
        if (peaks[b] > pMax) pMax = peaks[b];
        bSum += bass[b]; mSum += mids[b]; hSum += highs[b];
      }
      const n = b1 - b0;
      const barH = (pMax / 255) * H;
      ctx.fillStyle = this._color(bSum / n, mSum / n, hSum / n);
      ctx.fillRect(x, H - barH, 1, barH);
    }

    // Played-region darken
    const px = Math.floor((this.currentTime / decodedDuration) * W);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, px, H);

    // Track markers
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const t of this.tracks) {
      const x = Math.round((t.startSeconds / decodedDuration) * W);
      ctx.fillRect(x, 0, 1, H);
    }

    // Playhead
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.max(0, px - 1), 0, 2, H);
  }

  _renderZoom() {
    const { ctx, W, H } = this._setup(this.zm);
    const { peaks, bass, mids, highs, numBuckets, bucketSecs, duration } = this;
    const ct = this.currentTime;

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0a0a';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const ZOOM = 30; // seconds visible
    const tStart      = ct - ZOOM / 2;
    const tEnd        = ct + ZOOM / 2;
    const bStart      = Math.max(0, Math.floor(tStart / bucketSecs));
    const bEnd        = Math.min(numBuckets, Math.ceil(tEnd / bucketSecs));
    const pxPerSec    = W / ZOOM;
    const pxPerBucket = Math.max(1, Math.ceil(pxPerSec * bucketSecs));
    const half        = H / 2;

    for (let b = bStart; b < bEnd; b++) {
      const bTime = b * bucketSecs;
      const x     = Math.floor((bTime - tStart) * pxPerSec);
      const barH  = (peaks[b] / 255) * half * 0.92;
      ctx.fillStyle = this._color(bass[b], mids[b], highs[b]);
      ctx.fillRect(x, half - barH, pxPerBucket, barH * 2);
    }

    // Track markers + labels
    ctx.font = '10px "SF Mono", "Fira Code", Consolas, monospace';
    for (const t of this.tracks) {
      if (t.startSeconds < tStart - 2 || t.startSeconds > tEnd + 2) continue;
      const x = Math.round((t.startSeconds - tStart) * pxPerSec);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x, 0, 1, H);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(String(t.track).padStart(2, '0'), x + 3, 11);
    }

    // Centre playhead
    const cx = Math.round(W / 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx, 0, 2, H);

    // Current time label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px "SF Mono", "Fira Code", Consolas, monospace';
    ctx.fillText(this._fmt(ct), cx + 5, H - 5);
  }

  _fmt(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  _bindEvents() {
    this.ov.addEventListener('click', (e) => {
      if (!this.numBuckets) return;
      const decodedDuration = this.numBuckets * this.bucketSecs;
      const r = this.ov.getBoundingClientRect();
      this.onSeek(Math.max(0, Math.min(decodedDuration,
        ((e.clientX - r.left) / r.width) * decodedDuration
      )));
    });

    this.zm.addEventListener('click', (e) => {
      if (!this.duration) return;
      const r    = this.zm.getBoundingClientRect();
      const ZOOM = 30;
      const t    = (this.currentTime - ZOOM / 2) + ((e.clientX - r.left) / r.width) * ZOOM;
      this.onSeek(Math.max(0, Math.min(this.duration, t)));
    });

    // Re-render when the container resizes
    const ro = new ResizeObserver(() => {
      this._invalidateCache();
      if (this.peaks) { this._renderOverview(); this._renderZoom(); }
    });
    ro.observe(this.ov.parentElement);
  }
}
