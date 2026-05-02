'use strict';

const path = require('path');
const fs = require('fs');
const { logWarn } = require('./logger');

const AUDIO_FILE_EXTS = new Set(['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav', '.opus', '.wma', '.cue']);

// Simple bounded Map: evicts oldest entry when maxSize is exceeded
class BoundedMap extends Map {
  constructor(maxSize) { super(); this._max = maxSize; }
  set(key, value) {
    if (this.has(key)) this.delete(key); // refresh position
    super.set(key, value);
    if (this.size > this._max) {
      const oldest = this.keys().next().value;
      this.delete(oldest);
    }
    return this;
  }
}

function resolveAndValidate(inputPath, allowedRoots) {
  if (!inputPath) return null;
  const resolved = path.resolve(inputPath);
  if (!allowedRoots || allowedRoots.length === 0) return null;
  const ok = allowedRoots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
  return ok ? resolved : null;
}

function serverEscapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Auto-refresh an access token if it expires within 60 s.
// Surfaces refresh failure via logWarn so silent failures are visible.
async function ensureFreshToken(config, refreshFn, ctx = 'auth') {
  if (config.expires_at && Date.now() > config.expires_at - 60000) {
    try { return await refreshFn(config); }
    catch (err) { logWarn(ctx, err, 'token refresh failed'); }
  }
  return config;
}

async function hasMusic(dirPath) {
  try {
    const files = await fs.promises.readdir(dirPath);
    return files.some((f) => AUDIO_FILE_EXTS.has(f.slice(f.lastIndexOf('.')).toLowerCase()));
  } catch (_) {
    return false;
  }
}

// Wrap a promise with a wall-clock timeout. Used to bound per-entry directory
// scans on stalled network mounts (SMB/NFS) so the SSE worker pool can keep
// moving instead of waiting forever on one bad subdir.
function withTimeout(promise, ms, fallback) {
  let t;
  return Promise.race([
    promise,
    new Promise((resolve) => { t = setTimeout(() => resolve(fallback), ms); }),
  ]).finally(() => clearTimeout(t));
}

module.exports = {
  AUDIO_FILE_EXTS,
  BoundedMap,
  resolveAndValidate,
  serverEscapeHtml,
  ensureFreshToken,
  hasMusic,
  withTimeout,
};
