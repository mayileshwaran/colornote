const { contextBridge, ipcRenderer } = require('electron');

// Only expose a small, safe set of file operations to the renderer.
// No direct fs/node access is given to the page.
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  saveFileAs: (content, defaultName) => ipcRenderer.invoke('dialog:saveFileAs', { content, defaultName })
});
