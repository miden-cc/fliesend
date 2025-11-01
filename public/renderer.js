/**
 * fließend - Renderer Process
 * レンダラープロセスのメインスクリプト
 */

// DOM要素の取得
const openFolderBtn = document.getElementById('openFolderBtn');
const outlineTree = document.getElementById('outlineTree');
const statusBar = document.getElementById('statusBar');

/**
 * 初期化
 */
function init() {
  console.log('fließend initialized');
  updateStatus('準備完了');

  // イベントリスナーの設定
  setupEventListeners();
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  // フォルダを開くボタン
  openFolderBtn.addEventListener('click', handleOpenFolder);
}

/**
 * フォルダを開く処理
 */
async function handleOpenFolder() {
  updateStatus('フォルダを選択中...');
  console.log('フォルダを開く（実装予定）');

  // TODO: Phase 1でファイルシステムAPIと連携
  setTimeout(() => {
    updateStatus('準備完了');
  }, 500);
}

/**
 * ステータスバーの更新
 */
function updateStatus(message) {
  statusBar.textContent = message;
}

/**
 * アプリケーションの起動
 */
document.addEventListener('DOMContentLoaded', init);

// デバッグ用: Electron APIの情報を表示
if (window.electronAPI) {
  console.log('Electron API available');
  console.log('Platform:', window.electronAPI.platform);
  console.log('Versions:', window.electronAPI.versions);
}
