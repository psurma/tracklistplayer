'use strict';

// Shared OAuth refresh — eliminates near-duplicate refresh logic in
// routes/spotify.js and routes/soundcloud.js. Each provider just supplies
// the token URL, the auth/body builder, and a config store.

const { fetchWithTimeout } = require('./http');
const { logWarn } = require('./logger');

/**
 * Refresh an OAuth access token.
 * @param {object} opts
 * @param {string} opts.tokenUrl              token endpoint URL
 * @param {object} opts.config                current config (must have refresh_token)
 * @param {object} opts.store                 config store with .write()
 * @param {object} [opts.headers]             extra headers (e.g. Basic auth for Spotify)
 * @param {URLSearchParams} opts.params       request body
 * @param {string} [opts.context='oauth']     log context tag
 * @returns {Promise<object>} updated config (already persisted)
 */
async function refreshOAuthToken({ tokenUrl, config, store, headers = {}, params, context = 'oauth' }) {
  const tokenRes = await fetchWithTimeout(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json; charset=utf-8',
      ...headers,
    },
    body: params.toString(),
  }, 15000);
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    throw new Error(`${context} refresh failed: HTTP ${tokenRes.status} ${body.slice(0, 200)}`);
  }
  const tokenData = await tokenRes.json();
  const updated = {
    ...config,
    access_token: tokenData.access_token,
    expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };
  if (tokenData.refresh_token) updated.refresh_token = tokenData.refresh_token;
  if (tokenData.scope) updated.granted_scope = tokenData.scope;
  try {
    await store.write(updated);
  } catch (err) {
    logWarn(context, err, 'failed to persist refreshed token');
  }
  return updated;
}

module.exports = { refreshOAuthToken };
