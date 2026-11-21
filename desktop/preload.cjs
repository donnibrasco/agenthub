// The only things the AgentHub page can do with the desktop app: read the connector status,
// pair this computer, and ask for a re-check. No other access to the computer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agenthubDesktop', {
  platform: process.platform,
  getStatus: () => ipcRenderer.invoke('agenthub:status'),
  pair: (deviceId, key) => ipcRenderer.invoke('agenthub:pair', { deviceId, key }),
  checkAgain: () => ipcRenderer.invoke('agenthub:check'),
  onStatus: callback => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('agenthub:status', listener);
    return () => ipcRenderer.removeListener('agenthub:status', listener);
  },
});
