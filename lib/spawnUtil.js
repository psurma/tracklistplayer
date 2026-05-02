'use strict';

const { spawn } = require('child_process');
const { SPAWN_ENV } = require('./env');

// Run ffmpeg (or any binary) with a wall-clock timeout. Returns { code, stdout }.
// On timeout, sends SIGKILL so a stuck child cannot leak forever.
function runWithTimeout(cmd, args, { timeoutMs = 60000, captureStderr = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', captureStderr ? 'pipe' : 'ignore'],
      env: SPAWN_ENV,
    });
    const bufs = [];
    let killed = false;
    let settled = false;
    const t = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch (_) {}
    }, timeoutMs);

    if (child.stdout) child.stdout.on('data', (c) => bufs.push(c));
    let stderr = '';
    if (captureStderr && child.stderr) {
      child.stderr.on('data', (c) => { stderr += c.toString(); });
    }
    const done = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve({
        code: typeof code === 'number' ? code : -1,
        stdout: Buffer.concat(bufs),
        stderr,
        killed,
      });
    };
    child.on('close', done);
    child.on('error', () => done(-1));
  });
}

module.exports = { runWithTimeout };
