const { contextBridge, ipcRenderer } = require('electron');

/**
 * プリロードスクリプト
 * レンダラープロセスとメインプロセス間の安全な通信を提供
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // システム情報
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },

  // ダイアログ
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // ファイルシステム
  readTree: (folderPath) => ipcRenderer.invoke('fs:readTree', folderPath),
  openFile: (filePath) => ipcRenderer.invoke('fs:openFile', filePath),
  moveNode: (sourcePath, destParentPath) => ipcRenderer.invoke('fs:moveNode', sourcePath, destParentPath),
  createNode: (parentPath, nodeName, type) => ipcRenderer.invoke('fs:createNode', parentPath, nodeName, type),
  deleteNode: (nodePath) => ipcRenderer.invoke('fs:deleteNode', nodePath),
  renameNode: (oldPath, newName) => ipcRenderer.invoke('fs:renameNode', oldPath, newName)
});
