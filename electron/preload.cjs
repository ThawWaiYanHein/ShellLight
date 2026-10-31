const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('shelllight', {
  load: () => ipcRenderer.invoke('load'),
  save: (data, credential) => ipcRenderer.invoke('save', data, credential),
  connect: id => ipcRenderer.invoke('connect', id),
  pickKey: () => ipcRenderer.invoke('pick-key'),
  importSSH: () => ipcRenderer.invoke('import-ssh'),
  agentStatus: () => ipcRenderer.invoke('agent-status'),
  setupAgent: () => ipcRenderer.invoke('agent-setup'),
  unlockKey: file => ipcRenderer.invoke('agent-unlock', file),
});
