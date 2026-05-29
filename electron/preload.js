const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  exportPdf: (options) => ipcRenderer.invoke('export:pdf', options),
  exportHtml: (options) => ipcRenderer.invoke('export:html', options),
});
