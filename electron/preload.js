const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  callPython: (data) => ipcRenderer.invoke('call-python', data)
});
