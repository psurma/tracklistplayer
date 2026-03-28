'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setMiniPlayer:  (mini) => ipcRenderer.invoke('set-mini-player', mini),
  pickDirectory:  ()     => ipcRenderer.invoke('pick-directory'),
  openExternal:   (url)  => ipcRenderer.invoke('open-external', url),
  revealFile:     (path) => ipcRenderer.invoke('reveal-in-finder', path),
  fixAudioInput:  ()     => ipcRenderer.invoke('fix-audio-input'),
  updateDiscordPresence: (data) => ipcRenderer.invoke('update-discord-presence', data),
  platform:       process.platform,
});
