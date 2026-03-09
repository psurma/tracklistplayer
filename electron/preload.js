'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setMiniPlayer:  (mini) => ipcRenderer.invoke('set-mini-player', mini),
  pickDirectory:  ()     => ipcRenderer.invoke('pick-directory'),
  openExternal:   (url)  => ipcRenderer.invoke('open-external', url),
  revealFile:     (path) => ipcRenderer.invoke('reveal-in-finder', path),
  platform:       process.platform,
});
