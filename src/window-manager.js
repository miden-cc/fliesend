const { app, BrowserWindow } = require('electron');
const path = require('path');

// 開発モードの判定
const isDev = process.argv.includes('--dev');

/**
 * メインウィンドウを作成
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    title: 'fließend'
  });

  // HTMLファイルを読み込み
  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  // 開発モードの場合は開発者ツールを開く
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    // メインウィンドウがクローズされた際の処理
  });

  return mainWindow;
}

/**
 * アプリケーションのライフサイクルを設定
 */
function setupAppLifecycle() {
  /**
   * アプリケーション準備完了時
   */
  app.whenReady().then(() => {
    const mainWindow = createWindow();

    // IPCハンドラーの設定
    const { setupIpcHandlers } = require('./ipc-handlers');
    setupIpcHandlers(mainWindow);

    // macOSの場合、ウィンドウが全て閉じられてもアプリは終了しない
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  /**
   * 全ウィンドウが閉じられた時
   * macOS以外ではアプリを終了
   */
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

/**
 * 開発モードの設定
 */
async function setupDevMode() {
  if (isDev) {
    // デバッグポートの設定
    (async () => {
      const getPort = (await import('get-port')).default;
      const port = await getPort({ port: 9223 }); // Electron's default debugging port
      app.commandLine.appendSwitch('remote-debugging-port', port.toString());
      console.log(`Debugging port set to ${port}`);
    })();

    // ホットリロードの有効化
    try {
      require('electron-reload')(__dirname, {
        electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
        hardResetMethod: 'exit'
      });
    } catch (err) {
      console.log('electron-reload not found. Hot reload disabled.');
    }
  }
}

module.exports = {
  createWindow,
  setupAppLifecycle,
  setupDevMode
};
