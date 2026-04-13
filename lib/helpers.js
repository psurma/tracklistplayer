'use strict';

const path = require('path');
const fs = require('fs');

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

// Shared helper: auto-refresh an access token if it expires within 60 s
async function ensureFreshToken(config, refreshFn) {
  if (config.expires_at && Date.now() > config.expires_at - 60000) {
    try { return await refreshFn(config); } catch (err) { console.warn('[auth] token refresh failed:', err.message); }
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

module.exports = {
  AUDIO_FILE_EXTS,
  BoundedMap,
  resolveAndValidate,
  serverEscapeHtml,
  ensureFreshToken,
  hasMusic,
};
