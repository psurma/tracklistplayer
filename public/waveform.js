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
    this.numBuckets    = 0;
    this.bucketSecs    = 0.1;
    this.duration      = 0; // ffmpeg decoded duration = numBuckets * bucketSecs (authoritative)
    this.tracks        = [];
    this.currentTime = 0;
    this._raf = null;
    this._seekActive    = false;
    this._seekAnchor    = 0;   // waveform time at the moment of seek
    this._seekAnchorRef = 0;   // performance.now() at the moment of seek

    this._bindEvents();
  }

  // Call this at every seek site instead of setting currentTime directly.
  // Uses real-world clock to extrapolate position until audio.currentTime catches up,
  // preventing the RAF loop from snapping back to the stale pre-seek value.
  seekTo(t) {
    this.currentTime    = t;
    this._seekAnchor    = t;
    this._seekAnchorRef = performance.now();
    this._seekActive    = true;
  }

  // Load waveform from API response + CUE track list.
  // liveDuration = audio.duration if already known — avoids wrong initial render on VBR files.
  load(apiData, tracks, liveDuration) {
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
    this.numBuckets    = apiData.numBuckets;
    this.bucketSecs    = apiData.bucketSecs;
    this.duration = apiData.duration; // = numBuckets * bucketSecs (from ffmpeg)
    this.tracks        = tracks || [];
    this._computeTrackHues();
    this._ovTime       = -999; // force full overview redraw on first tick
    this._invalidateCache();
    this._renderOverview();
  }

  // Called every animation frame by app.js — reads audio time directly for 60 fps scrolling
  tick(audioCurrentTime) {
    if (this._seekActive) {
      // Extrapolate using real-world clock so the waveform advances smoothly
      // even while audio.currentTime is still catching up after a seek.
      const elapsed = (performance.now() - this._seekAnchorRef) / 1000;
      this.currentTime = this._seekAnchor + elapsed;
      // Exit seek mode once audio.currentTime is within 0.3 s of our extrapolation
      if (Math.abs(audioCurrentTime - this.currentTime) < 0.3) {
        this._seekActive = false;
        this.currentTime = audioCurrentTime;
      }
    } else {
      this.currentTime = audioCurrentTime;
    }
    if (!this.peaks) return;
    this._renderZoom();
    // Overview is cheaper — only redraw when playhead has moved noticeably
    if (Math.abs(this.currentTime - this._ovTime) > 1) {
      this._ovTime = this.currentTime;
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

  // Assign each track a hue using the golden angle so consecutive tracks
  // are always visually distinct and spread evenly around the colour wheel.
  _computeTrackHues() {
    const GOLDEN = 137.508;
    this.trackHues = (this.tracks || []).map((_, i) => Math.round(i * GOLDEN) % 360);
  }

  // Return the interpolated hue offset for a given audio time, smoothly
  // blending to the next track's hue during the final FADE seconds.
  _trackHueAt(audioTime) {
    const tracks = this.tracks;
    const hues   = this.trackHues;
    if (!tracks || tracks.length === 0) return 0;

    let ti = 0;
    for (let i = tracks.length - 1; i >= 0; i--) {
      if (audioTime >= tracks[i].startSeconds) { ti = i; break; }
    }

    const hue0 = hues[ti] || 0;
    const FADE = 10; // seconds over which hues blend at track boundaries

    if (ti + 1 < tracks.length) {
      const gap = tracks[ti + 1].startSeconds - audioTime;
      if (gap >= 0 && gap < FADE) {
        const frac  = 1 - gap / FADE;
        const hue1  = hues[ti + 1] || 0;
        const delta = ((hue1 - hue0 + 540) % 360) - 180; // shortest arc
        return ((hue0 + delta * frac) + 360) % 360;
      }
    }
    return hue0;
  }

  // DJay-style frequency colour: red=bass, yellow=low-mid, green=high-mid, blue=highs.
  // hueShift rotates the whole palette per track so consecutive tracks stay distinct.
  _color(b, m, h, hueShift = 0) {
    const peak = Math.max(b, m, h, 1);
    // Weighted centre-of-gravity across the four frequency bands mapped to hue:
    //   bass(0°/red) → low-mid(60°/yellow) → high-mid(120°/green) → highs(240°/blue)
    const total = b + m * 0.7 + h * 0.5 + 1;
    const freqHue = (b * 0 + m * 0.7 * 60 + h * 0.5 * 200) / total;
    const hue = Math.round(((freqHue + hueShift) % 360 + 360) % 360);
    const lit = Math.round(18 + (peak / 255) * 42); // 18–60 %
    return `hsl(${hue},90%,${lit}%)`;
  }

  _renderOverview() {
    const { ctx, W, H } = this._setup(this.ov);
    const { peaks, bass, mids, highs, numBuckets, bucketSecs, duration } = this;
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
      const n        = b1 - b0;
      const barH     = (pMax / 255) * H;
      // b * bucketSecs = actual decoded time for this bucket (no audioDuration scaling)
      const audioT   = b0 * bucketSecs;
      const hueShift = this._trackHueAt(audioT);
      ctx.fillStyle  = this._color(bSum / n, mSum / n, hSum / n, hueShift);
      ctx.fillRect(x, H - barH, 1, barH);
    }

    // All positions use decoded duration as the reference so bars, markers,
    // and playhead are all in the same coordinate space.
    const px = Math.floor((this.currentTime / duration) * W);

    // Played-region darken
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, px, H);

    // Track markers
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const t of this.tracks) {
      const x = Math.round((t.startSeconds / duration) * W);
      ctx.fillRect(x, 0, 1, H);
    }

    // Playhead
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.max(0, px - 1), 0, 2, H);
  }

  _renderZoom() {
    const { ctx, W, H } = this._setup(this.zm);
    const { peaks, bass, mids, highs, numBuckets, bucketSecs } = this;
    const ct = this.currentTime;

    const cs   = getComputedStyle(document.documentElement);
    const bg   = cs.getPropertyValue('--bg').trim()   || '#0a0a0a';
    const fg   = cs.getPropertyValue('--text').trim() || '#e8e8f0';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const ZOOM   = 30; // seconds visible
    const tStart = ct - ZOOM / 2;
    const tEnd   = ct + ZOOM / 2;

    // bucket b covers decoded time b*bucketSecs — no audioDuration scaling needed
    const bStart = Math.max(0, Math.floor(tStart / bucketSecs));
    const bEnd   = Math.min(numBuckets, Math.ceil(tEnd / bucketSecs));

    const pxPerSec    = W / ZOOM;
    const pxPerBucket = Math.max(1, Math.ceil(pxPerSec * bucketSecs));
    const half        = H / 2;

    for (let b = bStart; b < bEnd; b++) {
      const bAudioTime = b * bucketSecs; // raw decoded time — the fix for VBR drift
      const x          = Math.floor((bAudioTime - tStart) * pxPerSec);
      const barH       = (peaks[b] / 255) * half * 0.92;
      const hueShift   = this._trackHueAt(bAudioTime);
      ctx.fillStyle    = this._color(bass[b], mids[b], highs[b], hueShift);
      ctx.fillRect(x, half - barH, pxPerBucket, barH * 2);
    }

    // Track markers — startSeconds is already in audio time
    ctx.font = '10px "SF Mono", "Fira Code", Consolas, monospace';
    for (const t of this.tracks) {
      if (t.startSeconds < tStart - 2 || t.startSeconds > tEnd + 2) continue;
      const x = Math.round((t.startSeconds - tStart) * pxPerSec);
      ctx.fillStyle = 'rgba(128,128,128,0.55)';
      ctx.fillRect(x, 0, 1, H);
      ctx.fillStyle = fg;
      ctx.fillText(String(t.track).padStart(2, '0'), x + 3, 11);
    }

    // Centre playhead
    const cx = Math.round(W / 2);
    ctx.fillStyle = fg;
    ctx.fillRect(cx, 0, 2, H);

    // Current time label
    ctx.fillStyle = fg;
    ctx.font = '11px "SF Mono", "Fira Code", Consolas, monospace';
    ctx.fillText(this._fmt(ct), cx + 5, H - 5);
  }

  _fmt(s) {
    if (!isFinite(s) || s < 0) return '0:00.000';
    const h  = Math.floor(s / 3600);
    const m  = Math.floor((s % 3600) / 60);
    const ms = Math.floor((s % 1) * 1000);
    const ss = `${String(Math.floor(s % 60)).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
    return `${m}:${ss}`;
  }

  _bindEvents() {
    const ZOOM = 30;

    // ── Overview: proportional seek (position within full track) ──────────────
    let ovDragging = false;
    this.ov.addEventListener('mousedown', (e) => {
      if (!this.duration) return;
      ovDragging = true;
      document.body.style.userSelect = 'none';
      const r = this.ov.getBoundingClientRect();
      this.onSeek(Math.max(0, Math.min(this.duration, ((e.clientX - r.left) / r.width) * this.duration)));
    });
    document.addEventListener('mousemove', (e) => {
      if (!ovDragging || !this.duration) return;
      const r = this.ov.getBoundingClientRect();
      this.onSeek(Math.max(0, Math.min(this.duration, ((e.clientX - r.left) / r.width) * this.duration)));
    });
    document.addEventListener('mouseup', () => { if (ovDragging) { ovDragging = false; document.body.style.userSelect = ''; } });

    // ── Zoom: anchor-based seek — drag offset from click position ─────────────
    // Capturing anchorTime + anchorX at mousedown prevents the feedback loop
    // where this.currentTime changes on each onSeek(), causing runaway speed.
    let zmDragging = false;
    let zmAnchorTime = 0;
    let zmAnchorX = 0;

    this.zm.addEventListener('mousedown', (e) => {
      if (!this.duration) return;
      zmDragging = true;
      zmAnchorTime = this.currentTime;
      zmAnchorX = e.clientX;
      document.body.style.userSelect = 'none';
      // Seek to clicked position relative to centre
      const r = this.zm.getBoundingClientRect();
      const t = this.currentTime - ZOOM / 2 + ((e.clientX - r.left) / r.width) * ZOOM;
      this.onSeek(Math.max(0, Math.min(this.duration, t)));
    });
    document.addEventListener('mousemove', (e) => {
      if (!zmDragging || !this.duration) return;
      const r  = this.zm.getBoundingClientRect();
      const dx = e.clientX - zmAnchorX;
      const t  = zmAnchorTime - (dx / r.width) * ZOOM;
      this.onSeek(Math.max(0, Math.min(this.duration, t)));
    });
    document.addEventListener('mouseup', () => { if (zmDragging) { zmDragging = false; document.body.style.userSelect = ''; } });

    // Re-render when the container resizes
    const ro = new ResizeObserver(() => {
      this._invalidateCache();
      if (this.peaks) { this._renderOverview(); this._renderZoom(); }
    });
    ro.observe(this.ov.parentElement);
  }
}
