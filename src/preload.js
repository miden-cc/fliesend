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
  readTree: (folderPath) => ipcRenderer.invoke('fs:readTree', folderPath)
});
