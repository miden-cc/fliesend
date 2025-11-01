const { contextBridge, ipcRenderer } = require('electron');

/**
 * プリロードスクリプト
 * レンダラープロセスとメインプロセス間の安全な通信を提供
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // 将来的にファイルシステムAPIなどをここに追加
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});
