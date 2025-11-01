const path = require('path');
const fs = require('fs').promises;

/**
 * ユニークIDを生成（簡易版UUID）
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

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
 * ファイル/フォルダの存在チェック
 * 存在する場合はエラーをスロー
 */
async function checkPathNotExists(targetPath, itemName) {
  try {
    await fs.access(targetPath);
    throw new Error(`同名のファイル/フォルダが既に存在します: ${itemName}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // ENOENT = ファイルが存在しない = OK
  }
}

module.exports = {
  buildTreeFromPath,
  checkPathNotExists
};
