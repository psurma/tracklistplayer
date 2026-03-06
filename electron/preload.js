'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setMiniPlayer: (mini) => ipcRenderer.invoke('set-mini-player', mini),
});
