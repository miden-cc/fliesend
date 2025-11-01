const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
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

/**
 * IPC Handlers
 */

// フォルダ選択ダイアログを開く
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// フォルダツリーを読み込む
ipcMain.handle('fs:readTree', async (event, folderPath) => {
  try {
    const tree = await buildTreeFromPath(folderPath);
    return tree;
  } catch (error) {
    console.error('Error reading tree:', error);
    throw error;
  }
});

// ファイルを外部エディタで開く
ipcMain.handle('fs:openFile', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    throw error;
  }
});

// ノードを移動（ファイル/フォルダを別のフォルダに移動）
ipcMain.handle('fs:moveNode', async (event, sourcePath, destParentPath) => {
  try {
    const nodeName = path.basename(sourcePath);
    const newPath = path.join(destParentPath, nodeName);

    // 移動先に同名のファイル/フォルダが既に存在するかチェック
    try {
      await fs.access(newPath);
      throw new Error(`移動先に同名のファイル/フォルダが既に存在します: ${nodeName}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // ENOENT = ファイルが存在しない = OK
    }

    // 移動を実行
    await fs.rename(sourcePath, newPath);

    console.log(`Moved: ${sourcePath} -> ${newPath}`);
    return newPath;
  } catch (error) {
    console.error('Error moving node:', error);
    throw error;
  }
});

/**
 * ファイルシステムのヘルパー関数
 */

/**
 * 指定されたパスからツリー構造を構築
 */
async function buildTreeFromPath(dirPath) {
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);

  // ファイルの場合
  if (stats.isFile()) {
    return {
      id: generateId(),
      name,
      path: dirPath,
      type: 'file',
      stats: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isReadOnly: !(stats.mode & 0o200)
      }
    };
  }

  // フォルダの場合
  const children = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // 隠しファイルをスキップ
      if (entry.name.startsWith('.')) {
        continue;
      }

      const entryPath = path.join(dirPath, entry.name);
      const childNode = await buildTreeFromPath(entryPath);
      children.push(childNode);
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  // 子要素をソート（フォルダ優先、名前順）
  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'ja');
  });

  return {
    id: generateId(),
    name,
    path: dirPath,
    type: 'folder',
    children,
    stats: {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isReadOnly: !(stats.mode & 0o200)
    }
  };
}

/**
 * ユニークIDを生成（簡易版UUID）
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
