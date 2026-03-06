'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
}

let mainWindow;

function createWindow() {
  const state = loadWindowState();

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
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
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
    mainWindow?.webContents.executeJavaScript(
      'document.getElementById("btn-play")?.click()'
    );
  });
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow?.webContents.executeJavaScript(
      'document.getElementById("btn-next")?.click()'
    );
  });
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow?.webContents.executeJavaScript(
      'document.getElementById("btn-prev")?.click()'
    );
  });
}

app.whenReady().then(() => {
  startServer();
  setTimeout(() => {
    createWindow();
    registerMediaKeys();
  }, 300);

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

// Mini player: shrink window to 80 px tall, always-on-top; restore on exit
let preMiniState = null;

ipcMain.handle('set-mini-player', (_event, mini) => {
  if (!mainWindow) return;
  if (mini) {
    preMiniState = mainWindow.getBounds();
    const { x, y, width, height } = preMiniState;
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setResizable(false);
    mainWindow.setMinimumSize(400, 80);
    // Anchor bottom edge so the window slides down rather than jumping to the top
    mainWindow.setBounds({ x, y: y + height - 80, width: Math.max(width, 500), height: 80 }, true);
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setResizable(true);
    if (preMiniState) {
      mainWindow.setMinimumSize(600, 400);
      mainWindow.setBounds(preMiniState, true);
      preMiniState = null;
    }
  }
});
