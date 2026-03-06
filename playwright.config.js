'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  use: {
    headless: true,
    baseURL: 'http://localhost:3123',
  },
  webServer: {
    command: 'node server.js',
    port: 3123,
    reuseExistingServer: true,
    timeout: 10000,
  },
  reporter: 'list',
});
