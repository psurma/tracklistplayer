'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  pendingSpotifyStates,
  pendingSoundcloudStates,
  getPendingLastfmAuth,
  setPendingLastfmAuth,
} = require('../../lib/oauth');

// ---- pendingSpotifyStates ----

describe('pendingSpotifyStates', () => {
  it('is a Map instance', () => {
    assert.ok(pendingSpotifyStates instanceof Map);
  });

  it('supports set, get, delete cycle', () => {
    const state = 'test-state-spotify-' + Date.now();
    const expiry = Date.now() + 60000;
    pendingSpotifyStates.set(state, expiry);
    assert.equal(pendingSpotifyStates.get(state), expiry);
    pendingSpotifyStates.delete(state);
    assert.equal(pendingSpotifyStates.has(state), false);
  });

  it('can check existence with has()', () => {
    const state = 'check-state-' + Date.now();
    assert.equal(pendingSpotifyStates.has(state), false);
    pendingSpotifyStates.set(state, Date.now() + 60000);
    assert.equal(pendingSpotifyStates.has(state), true);
    pendingSpotifyStates.delete(state);
  });
});

// ---- pendingSoundcloudStates ----

describe('pendingSoundcloudStates', () => {
  it('is a Map instance', () => {
    assert.ok(pendingSoundcloudStates instanceof Map);
  });

  it('supports set, get, delete cycle', () => {
    const state = 'test-state-sc-' + Date.now();
    const expiry = Date.now() + 60000;
    pendingSoundcloudStates.set(state, expiry);
    assert.equal(pendingSoundcloudStates.get(state), expiry);
    pendingSoundcloudStates.delete(state);
    assert.equal(pendingSoundcloudStates.has(state), false);
  });
});

// ---- pendingLastfmAuth ----

describe('pendingLastfmAuth getter/setter', () => {
  it('defaults to 0', () => {
    // Reset to known state
    setPendingLastfmAuth(0);
    assert.equal(getPendingLastfmAuth(), 0);
  });

  it('sets and gets a timestamp', () => {
    const ts = Date.now() + 300000;
    setPendingLastfmAuth(ts);
    assert.equal(getPendingLastfmAuth(), ts);
  });

  it('can be cleared back to 0', () => {
    setPendingLastfmAuth(Date.now() + 100000);
    setPendingLastfmAuth(0);
    assert.equal(getPendingLastfmAuth(), 0);
  });
});
