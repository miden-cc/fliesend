const { contextBridge, ipcRenderer } = require('electron');

/**
 * プリロードスクリプト
 * レンダラープロセスとメインプロセス間の安全な通信を提供
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // プラットフォーム情報
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },

  // ファイルシステムAPI
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  readTree: (path) => ipcRenderer.invoke('fs:readTree', path),
  moveNode: (sourcePath, destParentPath, newName) =>
    ipcRenderer.invoke('fs:moveNode', sourcePath, destParentPath, newName)
});
