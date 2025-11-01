const { app, BrowserWindow, dialog, ipcMain } = require('electron');
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

// ========================================
// IPC Handlers
// ========================================

/**
 * フォルダ選択ダイアログを表示
 */
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'フォルダを選択',
    buttonLabel: '選択'
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

/**
 * フォルダツリーを読み込み
 */
ipcMain.handle('fs:readTree', async (event, rootPath) => {
  try {
    const tree = await buildTree(rootPath);
    return { success: true, data: tree };
  } catch (error) {
    console.error('Error reading tree:', error);
    return { success: false, error: error.message };
  }
});

/**
 * フォルダツリーを再帰的に構築
 */
async function buildTree(dirPath, depth = 0, maxDepth = 10) {
  // 無限ループ防止
  if (depth > maxDepth) {
    return [];
  }

  const items = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // 隠しファイル・フォルダをスキップ
      if (entry.name.startsWith('.')) {
        continue;
      }

      const itemPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(itemPath);

      const node = {
        id: generateId(),
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'folder' : 'file',
        isExpanded: false,
        stats: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isReadOnly: !isWritable(stats)
        }
      };

      // フォルダの場合、子要素を再帰的に読み込み
      if (entry.isDirectory()) {
        node.children = await buildTree(itemPath, depth + 1, maxDepth);
      }

      items.push(node);
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return items;
}

/**
 * ユニークIDを生成（簡易版）
 */
function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * ファイル/フォルダが書き込み可能かチェック
 */
function isWritable(stats) {
  // Unixパーミッションの簡易チェック（所有者の書き込み権限）
  return (stats.mode & 0o200) !== 0;
}

/**
 * ノードを移動（ファイルシステムに反映）
 */
ipcMain.handle('fs:moveNode', async (event, sourcePath, destParentPath, newName) => {
  try {
    // 移動先のパスを構築
    const fileName = newName || path.basename(sourcePath);
    const destPath = path.join(destParentPath, fileName);

    // 同名ファイルのチェック
    try {
      await fs.access(destPath);
      // ファイルが存在する場合はエラー
      return {
        success: false,
        error: `同名のファイル/フォルダが既に存在します: ${fileName}`
      };
    } catch (err) {
      // ファイルが存在しない場合は正常（続行）
    }

    // パストラバーサル対策
    const resolvedDest = path.resolve(destPath);
    const resolvedDestParent = path.resolve(destParentPath);
    if (!resolvedDest.startsWith(resolvedDestParent)) {
      return {
        success: false,
        error: 'パストラバーサルが検出されました'
      };
    }

    // ファイル/フォルダを移動
    await fs.rename(sourcePath, destPath);

    return {
      success: true,
      newPath: destPath
    };

  } catch (error) {
    console.error('Error moving node:', error);

    // エラータイプに応じたメッセージ
    let errorMessage = error.message;
    if (error.code === 'EACCES') {
      errorMessage = 'ファイル操作の権限がありません';
    } else if (error.code === 'ENOENT') {
      errorMessage = 'ファイルまたはフォルダが見つかりません';
    } else if (error.code === 'EBUSY') {
      errorMessage = 'ファイルが使用中です';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
});
