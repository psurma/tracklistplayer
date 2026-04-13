'use strict';

// ── FancyScrubber ─────────────────────────────────────────────────────────────
// ElevenLabs-style timeline scrubber: time ruler, colour-coded track sections,
// waveform bars inside each section, and a floating playhead pill.

class FancyScrubber {
  constructor(canvas, onSeek, opts = {}) {
    this.canvas  = canvas;
    this.onSeek  = onSeek;

    this._showRuler      = opts.showRuler !== false;
    this._centerPlayhead = opts.centerPlayhead || false;
    this._panMode        = opts.panMode || false;

    // Waveform data
    this.peaks      = null;
    this.bass       = null;
    this.mids       = null;
    this.highs      = null;
    this.numBuckets = 0;
    this.bucketSecs = 0.1;
    this.duration   = 0;
    this.tracks     = [];
    this.trackHues  = [];

    // View state
    this.currentTime = 0;
    this.visibleSecs = 60;
    this._scrollSecs = 0;

    this._dragging = false;

    this._bindEvents();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  seekTo(t) {
    this.currentTime = t;
    // Immediately re-centre the zoom viewport so there's no one-frame lag
    if (this._centerPlayhead && this.duration > 0) {
      const half = this.visibleSecs / 2;
      this._scrollSecs = this._clamp(t - half, 0, Math.max(0, this.duration - this.visibleSecs));
    }
    this._draw();
  }

  load(apiData, tracks, liveDuration) {
    const dec = (b64) => {
      const bin = atob(b64);
      const u8  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    };
    this.peaks      = dec(apiData.peaks);
    this.bass       = dec(apiData.bass);
    this.mids       = dec(apiData.mids);
    this.highs      = dec(apiData.highs);
    this.numBuckets = apiData.numBuckets;
    this.bucketSecs = apiData.bucketSecs;
    this.duration   = apiData.duration;
    this.tracks     = tracks || [];
    this._computeTrackHues();
    this._invalidateCache();
    this._draw();
  }

  tick(audioCurrentTime) {
    if (!this.peaks) { this.currentTime = audioCurrentTime; return; }
    // Skip redraw when time hasn't changed (paused, no seek)
    if (audioCurrentTime === this._lastTickTime) return;
    this._lastTickTime = audioCurrentTime;
    this.currentTime = audioCurrentTime;

    // Overview mode: always show full track, no scrolling
    if (!this._showRuler && this.duration > 0) {
      this.visibleSecs = this.duration;
      this._scrollSecs = 0;
    }
    // Zoom mode with centerPlayhead: keep playhead centred
    else if (this._centerPlayhead && !this._dragging && this.duration > 0) {
      const half = this.visibleSecs / 2;
      this._scrollSecs = this._clamp(this.currentTime - half, 0, Math.max(0, this.duration - this.visibleSecs));
    }

    this._draw();
  }

  clear() {
    this.peaks = null;
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
  }

  setVisibleSecs(v) {
    const minV = 5;
    const maxV = Math.max(this.duration, minV);
    this.visibleSecs = Math.max(minV, Math.min(maxV, v));
    this._draw();
  }

  setBookmarks(bookmarks) {
    this._bookmarks = bookmarks || [];
    this._draw();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    if (!canvas._wfCache) canvas._wfCache = {};
    const cache = canvas._wfCache;
    if (!cache.valid) {
      const rect = canvas.getBoundingClientRect();
      const W    = Math.round(rect.width);
      const H    = Math.round(rect.height);
      const pw   = Math.round(W * dpr);
      const ph   = Math.round(H * dpr);
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
    if (this.canvas._wfCache) this.canvas._wfCache.valid = false;
  }

  _computeTrackHues() {
    const GOLDEN = 137.508;
    this.trackHues = (this.tracks || []).map((_, i) => Math.round(i * GOLDEN) % 360);
  }

  _trackHueAt(audioTime) {
    const tracks = this.tracks;
    const hues   = this.trackHues;
    if (!tracks || tracks.length === 0) return 0;

    let ti = 0;
    for (let i = tracks.length - 1; i >= 0; i--) {
      if (audioTime >= tracks[i].startSeconds) { ti = i; break; }
    }

    const hue0 = hues[ti] || 0;
    const FADE = 10;

    if (ti + 1 < tracks.length) {
      const gap = tracks[ti + 1].startSeconds - audioTime;
      if (gap >= 0 && gap < FADE) {
        const frac  = 1 - gap / FADE;
        const hue1  = hues[ti + 1] || 0;
        const delta = ((hue1 - hue0 + 540) % 360) - 180;
        return ((hue0 + delta * frac) + 360) % 360;
      }
    }
    return hue0;
  }

  _color(b, m, h, hueShift = 0, isDark = true) {
    const peak  = Math.max(b, m, h, 1);
    const total = b + m * 0.7 + h * 0.5 + 1;
    const freqHue = (b * 0 + m * 0.7 * 60 + h * 0.5 * 200) / total;
    const hue = Math.round(((freqHue + hueShift) % 360 + 360) % 360);
    // Dark mode: quiet=dim, loud=bright; Light mode: inverted so bars are visible on pale bg
    const lit = isDark
      ? Math.round(18 + (peak / 255) * 42)
      : Math.round(55 - (peak / 255) * 32);
    return `hsl(${hue},90%,${lit}%)`;
  }

  _fmt(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const h  = Math.floor(s / 3600);
    const m  = Math.floor((s % 3600) / 60);
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
    return `${m}:${ss}`;
  }

  _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  _draw() {
    const { ctx, W, H } = this._setup(this.canvas);
    const RULER_H = this._showRuler ? 24 : 0;
    const wfTop   = RULER_H;
    const wfH     = H - RULER_H;

    const { peaks, bass, mids, highs, numBuckets, bucketSecs, duration,
            tracks, trackHues, visibleSecs, currentTime } = this;

    // Auto-scroll: keep playhead at ~30% from left during playback (default mode only)
    if (this._showRuler && !this._centerPlayhead && !this._dragging && duration > 0) {
      const target = currentTime - visibleSecs * 0.3;
      this._scrollSecs = this._clamp(target, 0, Math.max(0, duration - visibleSecs));
    }

    const scrollSecs    = this._scrollSecs;
    const pixelsPerSec  = W / visibleSecs;

    // When pan-dragging, pin the playhead to the viewport centre visually
    const displayTime   = (this._panMode && this._dragging)
      ? scrollSecs + visibleSecs / 2
      : currentTime;

    const isDark = document.documentElement.dataset.theme !== 'light';

    // ── Background ──────────────────────────────────────────────────────────
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      || (isDark ? '#111114' : '#f4f4f7');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (!peaks) {
      if (this._showRuler) {
        this._drawRuler(ctx, W, H, RULER_H, wfTop, wfH, scrollSecs, pixelsPerSec, duration, currentTime, isDark);
      }
      return;
    }

    // ── Waveform strip ───────────────────────────────────────────────────────
    // For each track section, draw background + waveform bars
    const numTracks = tracks.length;

    for (let ti = 0; ti < (numTracks || 1); ti++) {
      const tStart = numTracks ? tracks[ti].startSeconds : 0;
      const tEnd   = numTracks && ti + 1 < numTracks ? tracks[ti + 1].startSeconds : duration;
      const hue    = trackHues[ti] || 0;

      // Map to pixel x range
      const xStart = (tStart - scrollSecs) * pixelsPerSec;
      const xEnd   = (tEnd   - scrollSecs) * pixelsPerSec;

      if (xEnd < 0 || xStart > W) continue; // off-screen

      const xClipL = Math.max(0, xStart);
      const xClipR = Math.min(W, xEnd);

      // Track background
      ctx.fillStyle = isDark ? `hsl(${hue},45%,10%)` : `hsl(${hue},40%,88%)`;
      ctx.fillRect(xClipL, wfTop, xClipR - xClipL, wfH);

      // Waveform bars within this time window
      const bStart = Math.max(0, Math.floor(tStart / bucketSecs));
      const bEnd   = Math.min(numBuckets, Math.ceil(tEnd / bucketSecs));
      const half   = wfH / 2;

      for (let b = bStart; b < bEnd; b++) {
        const bTime = b * bucketSecs;
        const bx    = (bTime - scrollSecs) * pixelsPerSec;
        if (bx + 2 < xClipL || bx > xClipR) continue;

        const barH     = (peaks[b] / 255) * half * 0.92;
        const hueShift = this._trackHueAt(bTime);
        ctx.fillStyle  = this._color(bass[b], mids[b], highs[b], hueShift, isDark);

        const bw = Math.max(1, Math.ceil(pixelsPerSec * bucketSecs));
        ctx.fillRect(bx, wfTop + half - barH, bw, barH * 2);
      }

      // Track label
      const labelX = Math.max(xClipL + 4, xStart + 4);
      const labelW = xClipR - labelX - 4;
      if (labelW > 20) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(xClipL, wfTop, xClipR - xClipL, wfH);
        ctx.clip();
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
        ctx.font = '10px "SF Mono","Fira Code",Consolas,monospace';
        const label = numTracks
          ? `${String(tracks[ti].track || (ti + 1)).padStart(2, '0')}${tracks[ti].title ? ' ' + tracks[ti].title : ''}`
          : '';
        if (label) ctx.fillText(label, labelX, wfTop + 13);
        ctx.restore();
      }
    }

    // ── Played region darken ─────────────────────────────────────────────────
    const playheadX = (displayTime - scrollSecs) * pixelsPerSec;
    if (playheadX > 0) {
      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.40)';
      ctx.fillRect(0, wfTop, Math.min(playheadX, W), wfH);
    }

    // ── Track divider lines ───────────────────────────────────────────────────
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    for (const t of tracks) {
      const x = Math.round((t.startSeconds - scrollSecs) * pixelsPerSec);
      if (x >= 0 && x <= W) ctx.fillRect(x, wfTop, 1, wfH);
    }

    // ── Bookmark markers ─────────────────────────────────────────────────────
    if (this._bookmarks && this._bookmarks.length) {
      for (const bm of this._bookmarks) {
        const bx = Math.round((bm.time - scrollSecs) * pixelsPerSec);
        if (bx < -4 || bx > W + 4) continue;
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(bx - 4, wfTop);
        ctx.lineTo(bx + 4, wfTop);
        ctx.lineTo(bx, wfTop + 8);
        ctx.closePath();
        ctx.fill();
        // Thin vertical line
        ctx.fillRect(bx, wfTop, 1, wfH);
      }
    }

    // ── Ruler + Playhead ─────────────────────────────────────────────────────
    if (this._showRuler) {
      this._drawRuler(ctx, W, H, RULER_H, wfTop, wfH, scrollSecs, pixelsPerSec, duration, displayTime, isDark);
    } else {
      // Overview: just draw the vertical playhead line, no pill
      const phX = Math.round((displayTime - scrollSecs) * pixelsPerSec);
      if (phX >= -2 && phX <= W + 2) {
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1db954';
        ctx.fillStyle = accent;
        ctx.fillRect(phX, 0, 2, H);
      }
    }
  }

  _drawRuler(ctx, W, H, RULER_H, wfTop, wfH, scrollSecs, pixelsPerSec, duration, currentTime, isDark = true) {
    // Ruler background
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, W, RULER_H);

    // Tick interval: pick the smallest nice step that gives >= 60px gap
    const NICE = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const rawStep = 60 / Math.max(pixelsPerSec, 0.001);
    const step = NICE.find((n) => n >= rawStep) || 600;

    const tFirst = Math.ceil(scrollSecs / step) * step;
    const tLast  = scrollSecs + W / Math.max(pixelsPerSec, 0.001);

    ctx.font = '9px "SF Mono","Fira Code",Consolas,monospace';

    for (let t = tFirst; t <= tLast + step; t += step) {
      const x = Math.round((t - scrollSecs) * pixelsPerSec);
      if (x < 0 || x > W) continue;

      // Major tick
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, RULER_H - 10, 1, 10);
      ctx.fillText(this._fmt(t), x + 3, RULER_H - 3);
    }

    // Minor ticks (half-step)
    if (step >= 2) {
      const minorStep = step / 2;
      const tFirstMinor = Math.ceil(scrollSecs / minorStep) * minorStep;
      for (let t = tFirstMinor; t <= tLast + minorStep; t += minorStep) {
        if (Math.abs((t % step)) < 0.001) continue; // skip major positions
        const x = Math.round((t - scrollSecs) * pixelsPerSec);
        if (x < 0 || x > W) continue;
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
        ctx.fillRect(x, RULER_H - 5, 1, 5);
      }
    }

    // ── Playhead ─────────────────────────────────────────────────────────────
    const phX = Math.round((currentTime - scrollSecs) * pixelsPerSec);
    if (phX >= -2 && phX <= W + 2) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c6af7';

      // Vertical line
      ctx.fillStyle = accent;
      ctx.fillRect(phX, 0, 2, H);

      // Floating pill above / in ruler
      const label    = this._fmt(currentTime);
      ctx.font       = '10px "SF Mono","Fira Code",Consolas,monospace';
      const tw       = ctx.measureText(label).width;
      const pillW    = tw + 10;
      const pillH    = 14;
      const pillX    = this._clamp(phX - pillW / 2, 2, W - pillW - 2);
      const pillY    = 3;
      const pillR    = 4;

      // Pill background
      ctx.fillStyle = isDark ? 'rgba(10,10,15,0.9)' : 'rgba(240,240,245,0.92)';
      ctx.beginPath();
      ctx.moveTo(pillX + pillR, pillY);
      ctx.lineTo(pillX + pillW - pillR, pillY);
      ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR, pillR);
      ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
      ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH, pillR);
      ctx.lineTo(pillX + pillR, pillY + pillH);
      ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR, pillR);
      ctx.lineTo(pillX, pillY + pillR);
      ctx.arcTo(pillX, pillY, pillX + pillR, pillY, pillR);
      ctx.closePath();
      ctx.fill();

      // Pill text
      ctx.fillStyle = isDark ? '#ffffff' : '#111114';
      ctx.fillText(label, pillX + 5, pillY + pillH - 3);
    }
  }

  _bindEvents() {
    const canvas = this.canvas;

    const getTime = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const frac = (clientX - rect.left) / rect.width;
      return this._clamp(this._scrollSecs + frac * this.visibleSecs, 0, this.duration || 0);
    };

    if (this._panMode) {
      // Pan mode: drag moves the viewport; Cmd+drag zooms; click (< 4px) seeks
      let panStartX = 0;
      let panStartScroll = 0;
      let panMoved = false;
      let zoomStartX = 0;
      let zoomStartVis = 0;
      let isZooming = false;

      canvas.addEventListener('mousedown', (e) => {
        if (!this.duration) return;
        document.body.style.userSelect = 'none';
        if (e.metaKey) {
          isZooming = true;
          zoomStartX = e.clientX;
          zoomStartVis = this.visibleSecs;
          canvas.style.cursor = 'ew-resize';
        } else {
          this._dragging = true;
          panStartX = e.clientX;
          panStartScroll = this._scrollSecs;
          panMoved = false;
        }
      });

      document.addEventListener('mousemove', (e) => {
        if (isZooming) {
          const dx = e.clientX - zoomStartX;
          // Drag right = zoom in (fewer secs visible); left = zoom out
          const newVis = zoomStartVis * Math.pow(2, -dx / 150);
          this.setVisibleSecs(newVis);
          return;
        }
        if (!this._dragging) return;
        const dx = e.clientX - panStartX;
        if (!panMoved && Math.abs(dx) < 4) return;
        panMoved = true;
        const rect = canvas.getBoundingClientRect();
        const secsPerPx = this.visibleSecs / rect.width;
        this._scrollSecs = this._clamp(
          panStartScroll - dx * secsPerPx,
          0,
          Math.max(0, this.duration - this.visibleSecs)
        );
        this._draw();
      });

      document.addEventListener('mouseup', (e) => {
        if (isZooming) {
          isZooming = false;
          canvas.style.cursor = '';
          document.body.style.userSelect = '';
          return;
        }
        if (!this._dragging) return;
        this._dragging = false;
        document.body.style.userSelect = '';
        if (panMoved) {
          // Seek to the time now at the centre of the viewport
          this.onSeek(this._scrollSecs + this.visibleSecs / 2);
        } else {
          // Treat as a click — seek to clicked position
          this.onSeek(getTime(e.clientX));
        }
      });

      // Touch pan
      let touchStartX = 0;
      let touchStartScroll = 0;
      let touchMoved = false;

      canvas.addEventListener('touchstart', (e) => {
        if (!this.duration) return;
        this._dragging = true;
        touchStartX = e.touches[0].clientX;
        touchStartScroll = this._scrollSecs;
        touchMoved = false;
      }, { passive: true });

      document.addEventListener('touchmove', (e) => {
        if (!this._dragging) return;
        const dx = e.touches[0].clientX - touchStartX;
        if (!touchMoved && Math.abs(dx) < 4) return;
        touchMoved = true;
        const rect = canvas.getBoundingClientRect();
        const secsPerPx = this.visibleSecs / rect.width;
        this._scrollSecs = this._clamp(
          touchStartScroll - dx * secsPerPx,
          0,
          Math.max(0, this.duration - this.visibleSecs)
        );
        this._draw();
      }, { passive: true });

      document.addEventListener('touchend', (e) => {
        if (!this._dragging) return;
        this._dragging = false;
        if (touchMoved) {
          this.onSeek(this._scrollSecs + this.visibleSecs / 2);
        } else if (e.changedTouches.length) {
          this.onSeek(getTime(e.changedTouches[0].clientX));
        }
      });

    } else {
      // Seek mode: drag anywhere to seek immediately
      canvas.addEventListener('mousedown', (e) => {
        if (!this.duration) return;
        this._dragging = true;
        document.body.style.userSelect = 'none';
        this.onSeek(getTime(e.clientX));
      });

      document.addEventListener('mousemove', (e) => {
        if (!this._dragging) return;
        this.onSeek(getTime(e.clientX));
      });

      document.addEventListener('mouseup', () => {
        if (!this._dragging) return;
        this._dragging = false;
        document.body.style.userSelect = '';
      });

      canvas.addEventListener('touchstart', (e) => {
        if (!this.duration) return;
        this._dragging = true;
        this.onSeek(getTime(e.touches[0].clientX));
      }, { passive: true });

      document.addEventListener('touchmove', (e) => {
        if (!this._dragging) return;
        this.onSeek(getTime(e.touches[0].clientX));
      }, { passive: true });

      document.addEventListener('touchend', () => {
        this._dragging = false;
      });
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      this._invalidateCache();
      this._draw();
    });
    ro.observe(canvas.parentElement || canvas);
  }
}
