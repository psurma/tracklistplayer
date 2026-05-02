'use strict';

// fetch with a wall-clock timeout. Bare fetch() never times out — a stalled
// upstream (Spotify/SoundCloud/MixesDB) would hang the request handler
// forever and pin the SSE/connection pool.

function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error(`fetch timeout after ${timeoutMs}ms`)), timeoutMs);
  // Compose with caller signal if provided
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort(opts.signal.reason);
    else opts.signal.addEventListener('abort', () => ac.abort(opts.signal.reason), { once: true });
  }
  return fetch(url, { ...opts, signal: ac.signal })
    .finally(() => clearTimeout(t));
}

module.exports = { fetchWithTimeout };
