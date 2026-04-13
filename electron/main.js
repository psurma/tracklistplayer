'use strict';

const { app, BrowserWindow, dialog, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// ── Graceful error handling ──────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  const msg = err?.message || String(err);
  console.error('[uncaughtException]', err);
  // Transient I/O errors (e.g. external drive hiccup) — log and continue
  const transient = err?.code === 'EIO' || err?.code === 'ENOENT';
  const externalPerm = err?.code === 'EPERM' && err?.path && !err.path.startsWith(app.getPath('userData'));
  if (transient || externalPerm) {
    return;
  }
  // Show a non-fatal dialog if the app is ready
  if (app.isReady()) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Unexpected Error',
      message: 'Something went wrong, but the app will try to keep running.',
      detail: msg,
      buttons: ['OK'],
    });
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ── Window state persistence ──────────────────────────────────────────────────
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (_) {
    return { width: 1280, height: 800, isMaximized: false };
  }
}

function saveWindowState(win) {
  if (win.isMinimized()) return;
  const state = { isMaximized: win.isMaximized() };
  if (!win.isMaximized()) {
    const b = win.getBounds();
    state.x = b.x; state.y = b.y;
    state.width = b.width; state.height = b.height;
  } else {
    // Preserve last non-maximized bounds so we have them after un-maximizing
    const prev = loadWindowState();
    state.x = prev.x; state.y = prev.y;
    state.width = prev.width || 1280; state.height = prev.height || 800;
  }
  try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (_) {}
}

// ── Express server ────────────────────────────────────────────────────────────
let server;
function startServer() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    process.argv = [process.argv[0], process.argv[1], ...args];
  }
  server = require('../server');
  return new Promise((resolve) => {
    if (server.listening) return resolve();
    server.once('listening', resolve);
    server.once('error', resolve); // don't block indefinitely on port error
  });
}

let mainWindow;

function createWindow() {
  const state = loadWindowState();

  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width:  state.width  || 1280,
    height: state.height || 800,
    minWidth: 600,
    minHeight: 400,
    title: 'Tracklist Player',
    backgroundColor: '#111114',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    // macOS: inline traffic lights, positioned so they don't overlap the dir input
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } } : {}),
  });

  if (state.isMaximized) mainWindow.maximize();

  // Save state on move/resize (debounced)
  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(mainWindow), 500);
  };
  mainWindow.on('resize', scheduleSave);
  mainWindow.on('move',   scheduleSave);
  mainWindow.on('maximize',   () => saveWindowState(mainWindow));
  mainWindow.on('unmaximize', () => saveWindowState(mainWindow));

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:3123')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Open external links (Spotify, SoundCloud) in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL('http://localhost:3123');

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

function registerMediaKeys() {
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow?.webContents.send('media-key', 'play-pause');
  });
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow?.webContents.send('media-key', 'next');
  });
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow?.webContents.send('media-key', 'prev');
  });
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();
  registerMediaKeys();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (server && server.close) server.close();
});

ipcMain.handle('reveal-in-finder', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('open-external', (_event, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});

ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select music folder',
  });
  return result.canceled ? null : result.filePaths[0];
});

// Ensure preferred audio input is active when playback starts (macOS only).
// Bluetooth headphones (AirPods etc.) grab the input and force a low-quality codec.
const { SPAWN_ENV } = require('../lib/env');
const AUDIO_SETTINGS_PATH = path.join(app.getPath('home'), '.tracklistplayer', 'audio-settings.json');
function getPreferredAudioInput() {
  try { return JSON.parse(fs.readFileSync(AUDIO_SETTINGS_PATH, 'utf8')).preferredInput || ''; }
  catch (_) { return ''; }
}
const AUDIO_CHECK_COOLDOWN_MS = 5000;
let lastAudioCheck = 0;

ipcMain.handle('fix-audio-input', () => {
  if (process.platform !== 'darwin') return;
  const now = Date.now();
  if (now - lastAudioCheck < AUDIO_CHECK_COOLDOWN_MS) return;
  lastAudioCheck = now;

  const preferred = getPreferredAudioInput();
  if (!preferred) return;
  execFile('SwitchAudioSource', ['-c', '-t', 'input'], { env: SPAWN_ENV }, (err, stdout) => {
    if (err) return;
    const current = stdout.trim();
    if (current !== preferred) {
      execFile('SwitchAudioSource', ['-t', 'input', '-s', preferred], { env: SPAWN_ENV }, () => {});
    }
  });
});

// ── Discord Rich Presence ────────────────────────────────────────────────────
let discordRPC = null;

function initDiscordRPC() {
  try {
    const DiscordRPC = require('discord-rpc');
    const clientId = '1355601025153273916'; // public Discord app ID (not a secret)
    discordRPC = new DiscordRPC.Client({ transport: 'ipc' });
    discordRPC.login({ clientId }).catch(() => { discordRPC = null; });
  } catch (_) {
    discordRPC = null;
  }
}

// Initialize after app is ready
app.whenReady().then(() => { initDiscordRPC(); });

ipcMain.handle('update-discord-presence', (_event, data) => {
  if (!discordRPC) return;
  try {
    discordRPC.setActivity({
      details: data.track || 'No track',
      state: data.artist || '',
      largeImageKey: 'app-icon',
      largeImageText: data.mix || 'Tracklist Player',
      startTimestamp: data.playing ? Math.floor(Date.now() / 1000 - (data.elapsed || 0)) : undefined,
    });
  } catch (_) {}
});

// Mini player: shrink window to 80 px tall, always-on-top; restore on exit
let preMiniState = null;

const MINI_H = 80; // just the footer strip

ipcMain.handle('set-mini-player', (_event, mini) => {
  if (!mainWindow) return;
  if (mini) {
    preMiniState = mainWindow.getBounds();
    const { x, y, width, height } = preMiniState;
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setResizable(true);           // allow width resize
    mainWindow.setMinimumSize(400, MINI_H);
    mainWindow.setMaximumSize(99999, MINI_H); // lock height
    // Anchor bottom edge so the window slides up rather than jumping to the top
    mainWindow.setBounds({ x, y: y + height - MINI_H, width: Math.max(width, 500), height: MINI_H }, true);
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMaximumSize(99999, 99999); // unlock height first
    mainWindow.setResizable(true);
    if (preMiniState) {
      mainWindow.setMinimumSize(600, 400);
      mainWindow.setBounds(preMiniState, true);
      preMiniState = null;
    }
  }
});
