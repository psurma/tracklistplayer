'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');

// Start the Express server in-process
let server;
function startServer() {
  // Pass any CLI args (skip first two: electron + main.js)
  const args = process.argv.slice(2);
  if (args.length > 0) {
    process.argv = [process.argv[0], process.argv[1], ...args];
  }
  server = require('../server');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'Tracklist Player',
    backgroundColor: '#111114',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    // macOS: show traffic lights but no title bar text
    titleBarStyle: 'hiddenInset',
  });

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:3123')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Open external links (Spotify etc) in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Disable default menu bar (keeps CMD+Q etc on macOS)
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadURL('http://localhost:3123');
}

function registerMediaKeys() {
  // These fire even when the window is in the background
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
  // Give the server a moment to bind before loading the URL
  setTimeout(() => {
    createWindow();
    registerMediaKeys();
  }, 300);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (server && server.close) {
    server.close();
  }
});

// Handle show-in-finder calls from renderer (alternative to /api/reveal)
ipcMain.handle('reveal-in-finder', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});
