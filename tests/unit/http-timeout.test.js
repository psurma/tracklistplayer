'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { fetchWithTimeout } = require('../../lib/http');

describe('fetchWithTimeout', () => {
  it('aborts a request that exceeds the timeout', async () => {
    // Server that never responds
    const server = http.createServer(() => { /* hang */ });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      const start = Date.now();
      await assert.rejects(
        fetchWithTimeout(`http://127.0.0.1:${port}/`, {}, 200),
        (err) => err.name === 'AbortError' || /abort|timeout/i.test(err.message)
      );
      assert.ok(Date.now() - start < 1000, 'should abort well under 1s');
    } finally {
      server.close();
    }
  });

  it('completes a normal request within timeout', async () => {
    const server = http.createServer((_req, res) => { res.end('hi'); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      const res = await fetchWithTimeout(`http://127.0.0.1:${port}/`, {}, 1000);
      assert.equal(res.status, 200);
      assert.equal(await res.text(), 'hi');
    } finally {
      server.close();
    }
  });
});
