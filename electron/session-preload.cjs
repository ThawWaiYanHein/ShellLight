const { contextBridge, ipcRenderer } = require('electron');
// A terminal cannot read settings, save connections, or manage credentials/agent.
contextBridge.exposeInMainWorld('shelllight', {
  sessionStart: () => ipcRenderer.invoke('session-start'),
  sessionInput: data => ipcRenderer.invoke('session-input', data),
  sessionResize: (cols, rows) => ipcRenderer.invoke('session-resize', cols, rows),
  onSession: callback => { const listener = (_, event) => callback(event); ipcRenderer.on('session-event', listener); return () => ipcRenderer.removeListener('session-event', listener); },
});
