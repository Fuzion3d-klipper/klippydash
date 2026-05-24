const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  minimize:   () => ipcRenderer.invoke('win-minimize'),
  maximize:   () => ipcRenderer.invoke('win-maximize'),
  close:      () => ipcRenderer.invoke('win-close'),
  fullscreen: () => ipcRenderer.invoke('win-fullscreen'),
  getProxyPort: () => ipcRenderer.invoke('get-proxy-port'),
});
