'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { refreshOAuthToken } = require('../../lib/refresh');

describe('refreshOAuthToken', () => {
  it('exchanges refresh_token, persists, and returns updated config', async () => {
    let received = null;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        received = body;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ access_token: 'NEW', expires_in: 3600, scope: 'foo bar' }));
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    const writes = [];
    const store = { write: async (data) => { writes.push(data); } };

    try {
      const params = new URLSearchParams();
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', 'OLD-RT');
      const updated = await refreshOAuthToken({
        tokenUrl: `http://127.0.0.1:${port}/token`,
        config: { client_id: 'cid', refresh_token: 'OLD-RT', access_token: 'OLD' },
        store,
        params,
        context: 'test',
      });
      assert.equal(updated.access_token, 'NEW');
      assert.equal(updated.granted_scope, 'foo bar');
      assert.ok(updated.expires_at > Date.now());
      assert.equal(writes.length, 1);
      assert.match(received, /grant_type=refresh_token/);
      assert.match(received, /refresh_token=OLD-RT/);
    } finally {
      server.close();
    }
  });

  it('throws on non-2xx response', async () => {
    const server = http.createServer((_req, res) => {
      res.statusCode = 401;
      res.end('bad token');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      await assert.rejects(
        refreshOAuthToken({
          tokenUrl: `http://127.0.0.1:${port}/token`,
          config: { refresh_token: 'x' },
          store: { write: async () => {} },
          params: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: 'x' }),
          context: 'test',
        }),
        /HTTP 401/
      );
    } finally {
      server.close();
    }
  });
});
