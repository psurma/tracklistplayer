'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const TLP_DIR = path.join(os.homedir(), '.tracklistplayer');

/**
 * Create a read/write config store backed by a JSON file.
 * @param {string} filePath - absolute path to the JSON config file
 * @returns {{ read: () => Promise<object>, write: (data: object) => Promise<void> }}
 */
function createConfigStore(filePath) {
  return {
    async read() {
      try {
        return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      } catch (_) {
        return {};
      }
    },
    async write(data) {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
    },
  };
}

/**
 * Express middleware that requires a valid auth token in the service config.
 * Attaches the parsed config to req.serviceConfig on success.
 * @param {object} configStore - a config store created by createConfigStore()
 * @param {string} tokenField - the config key to check (default: 'access_token')
 * @returns {Function} Express middleware
 */
function requireAuth(configStore, tokenField = 'access_token') {
  return async (req, res, next) => {
    const config = await configStore.read();
    if (!config[tokenField]) {
      return res.status(401).json({ error: 'Not connected' });
    }
    req.serviceConfig = config;
    next();
  };
}

module.exports = { TLP_DIR, createConfigStore, requireAuth };
