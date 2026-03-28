'use strict';

// ── LiveSpectrumRenderer ──────────────────────────────────────────────────────
// Real-time FFT spectrum bars drawn on a canvas, driven by the <audio> element
// or any MediaStream source via Web Audio API AnalyserNode.
//
// Usage:
//   const sr = new LiveSpectrumRenderer(canvas);
//   sr.connectAudioElement(audioEl);  // once
//   sr.start();   // begin animation
//   sr.stop();    // pause animation

class LiveSpectrumRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this._ctx = null;       // AudioContext
    this._analyser = null;
    this._source = null;    // connected MediaElementSource
    this._raf = null;
    this._freqData = null;
  }

  // Connect (or reconnect) an HTMLAudioElement.
  // Safe to call multiple times — only creates one MediaElementSource per element.
  connectAudioElement(audioEl) {
    if (!audioEl) return;

    // Reuse an existing AudioContext attached to this element
    if (!audioEl._lsrCtx) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaElementSource(audioEl);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        audioEl._lsrCtx     = ctx;
        audioEl._lsrSrc     = src;
        audioEl._lsrAnalyser = analyser;
      } catch (e) {
        console.warn('[LiveSpectrum] Web Audio setup failed:', e.message);
        return;
      }
    }

    this._ctx     = audioEl._lsrCtx;
    this._analyser = audioEl._lsrAnalyser;
    this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
  }

  start() {
    if (this._raf) return; // already running
    if (!this._analyser) return;
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this._draw();
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._clearCanvas();
  }

  _clearCanvas() {
    const c = this.canvas;
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, c.width, c.height);
  }

  _draw() {
    const analyser = this._analyser;
    const canvas   = this.canvas;
    if (!analyser || !canvas) return;

    // Sync canvas pixel size to display size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W    = Math.round(rect.width  * dpr);
    const H    = Math.round(rect.height * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }

    analyser.getByteFrequencyData(this._freqData);

    const g = canvas.getContext('2d');
    g.clearRect(0, 0, W, H);

    // Only render the lower half of the FFT bins (skip high-freq noise)
    const bins   = Math.floor(this._freqData.length * 0.6);
    const barW   = W / bins;
    const gap    = Math.max(1, Math.floor(barW * 0.15));

    // Gradient: teal-ish low → green mid → yellow-green high
    const grad = g.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0,   '#1a8a5a');
    grad.addColorStop(0.5, '#1db954');
    grad.addColorStop(1,   '#7fff5a');
    g.fillStyle = grad;

    for (let i = 0; i < bins; i++) {
      const v  = this._freqData[i] / 255;
      const bh = Math.max(1, Math.round(v * H));
      const x  = Math.round(i * barW);
      g.fillRect(x + gap, H - bh, Math.max(1, Math.round(barW) - gap * 2), bh);
    }
  }
}
