'use strict';

// Pending OAuth state tokens -- prevent CSRF on callbacks
const pendingSpotifyStates = new Map();
const pendingSoundcloudStates = new Map();
let pendingLastfmAuth = 0; // expiry timestamp; Last.fm doesn't support state param

// Periodically remove expired OAuth state tokens to prevent unbounded growth
const _cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [st, expiry] of pendingSpotifyStates) {
    if (now > expiry) pendingSpotifyStates.delete(st);
  }
  for (const [st, expiry] of pendingSoundcloudStates) {
    if (now > expiry) pendingSoundcloudStates.delete(st);
  }
  if (pendingLastfmAuth && now > pendingLastfmAuth) pendingLastfmAuth = 0;
}, 15 * 60 * 1000);

// Prevent the interval from keeping the process alive when the server closes
_cleanupInterval.unref();

module.exports = {
  pendingSpotifyStates,
  pendingSoundcloudStates,
  getPendingLastfmAuth() { return pendingLastfmAuth; },
  setPendingLastfmAuth(val) { pendingLastfmAuth = val; },
};
