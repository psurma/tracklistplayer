'use strict';

// Augment PATH so ffmpeg / SwitchAudioSource are found when running as a
// packaged Electron app, which inherits a minimal macOS PATH.
const SPAWN_ENV = {
  ...process.env,
  PATH: [process.env.PATH, '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(':'),
};

module.exports = { SPAWN_ENV };
