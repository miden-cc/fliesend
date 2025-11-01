const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// 開発モードの判定
const isDev = process.argv.includes('--dev');

// メインウィンドウの参照
let mainWindow;

/**
 * メインウィンドウを作成
 */
function createWindow() {
  mainWindow = new BrowserWindow({
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
    mainWindow = null;
  });
}

/**
 * アプリケーション準備完了時
 */
app.whenReady().then(() => {
  createWindow();

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

// 開発モードの場合、ホットリロードを有効化
if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (err) {
    console.log('electron-reload not found. Hot reload disabled.');
  }
}
