const { dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { buildTreeFromPath, checkPathNotExists } = require('./fs-operations');

/**
 * IPCハンドラーを設定
 * @param {BrowserWindow} mainWindow - メインウィンドウのインスタンス
 */
function setupIpcHandlers(mainWindow) {
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
      await checkPathNotExists(newPath, nodeName);

      // 移動を実行
      await fs.rename(sourcePath, newPath);

      console.log(`Moved: ${sourcePath} -> ${newPath}`);
      return newPath;
    } catch (error) {
      console.error('Error moving node:', error);
      throw error;
    }
  });

  // ノードを作成（ファイルまたはフォルダ）
  ipcMain.handle('fs:createNode', async (event, parentPath, nodeName, type) => {
    const newPath = path.join(parentPath, nodeName);
    try {
      // 存在チェック
      await checkPathNotExists(newPath, nodeName);

      if (type === 'file') {
        await fs.writeFile(newPath, ''); // 空のファイルを作成
      } else if (type === 'folder') {
        await fs.mkdir(newPath);
      } else {
        throw new Error(`無効なノードタイプです: ${type}`);
      }

      console.log(`Created ${type}: ${newPath}`);
      return buildTreeFromPath(newPath); // 作成したノードの情報を返す
    } catch (error) {
      console.error(`Error creating node:`, error);
      throw error;
    }
  });

  // ノードを削除
  ipcMain.handle('fs:deleteNode', async (event, nodePath) => {
    try {
      await fs.rm(nodePath, { recursive: true, force: true });
      console.log(`Deleted: ${nodePath}`);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting node:`, error);
      throw error;
    }
  });

  // ノード名を変更
  ipcMain.handle('fs:renameNode', async (event, oldPath, newName) => {
    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName);
    try {
      // 名前が変わっていない場合は何もしない
      if (oldPath === newPath) return newPath;

      // 存在チェック
      await checkPathNotExists(newPath, newName);

      await fs.rename(oldPath, newPath);
      console.log(`Renamed: ${oldPath} -> ${newPath}`);
      return newPath;
    } catch (error) {
      console.error(`Error renaming node:`, error);
      throw error;
    }
  });
}

module.exports = {
  setupIpcHandlers
};
