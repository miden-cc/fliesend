/**
 * fließend - Renderer Process
 * レンダラープロセスのメインスクリプト
 */

// DOM要素の取得
const openFolderBtn = document.getElementById('openFolderBtn');
const outlineTree = document.getElementById('outlineTree');
const statusBar = document.getElementById('statusBar');

// アプリケーション状態
let state = {
  rootPath: null,
  tree: null,
  expandedNodes: new Set()
};

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
  try {
    updateStatus('フォルダを選択中...');

    // フォルダ選択ダイアログを開く
    const folderPath = await window.electronAPI.openFolder();

    if (!folderPath) {
      updateStatus('準備完了');
      return;
    }

    updateStatus('フォルダを読み込み中...');

    // フォルダツリーを読み込む
    const tree = await window.electronAPI.readTree(folderPath);

    // 状態を更新
    state.rootPath = folderPath;
    state.tree = tree;
    state.expandedNodes.clear();
    state.expandedNodes.add(tree.id); // ルートは最初から展開

    // ツリーを描画
    renderTree();

    updateStatus(`読み込み完了: ${folderPath}`);
  } catch (error) {
    console.error('Error opening folder:', error);
    updateStatus('エラー: フォルダの読み込みに失敗しました');
    showError('フォルダの読み込みに失敗しました');
  }
}

/**
 * ツリーを描画
 */
function renderTree() {
  if (!state.tree) {
    outlineTree.innerHTML = `
      <div class="empty-state">
        <p>フォルダを選択して開始</p>
        <p class="empty-state-hint">「フォルダを開く」ボタンをクリック</p>
      </div>
    `;
    return;
  }

  // ツリー全体をクリア
  outlineTree.innerHTML = '';

  // ルートノードから描画
  renderNode(state.tree, 0);
}

/**
 * ノードを描画（再帰的）
 */
function renderNode(node, level) {
  const nodeElement = document.createElement('div');
  nodeElement.className = 'tree-node';
  nodeElement.dataset.nodeId = node.id;
  nodeElement.dataset.nodeType = node.type;

  // インデントの設定
  const indent = level * 20;
  nodeElement.style.paddingLeft = `${indent}px`;

  // ノードの内容
  const isExpanded = state.expandedNodes.has(node.id);
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;

  let icon = '';
  if (node.type === 'folder') {
    // フォルダアイコン（矢印）
    icon = hasChildren ? (isExpanded ? '▼' : '▶') : '▪';
  } else {
    // ファイルアイコン
    icon = '・';
  }

  nodeElement.innerHTML = `
    <span class="tree-node-icon">${icon}</span>
    <span class="tree-node-name">${escapeHtml(node.name)}</span>
  `;

  // クリックイベント
  if (node.type === 'folder') {
    nodeElement.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNodeExpansion(node.id);
    });
  }

  // ツリーに追加
  outlineTree.appendChild(nodeElement);

  // 子ノードを描画（展開されている場合）
  if (node.type === 'folder' && isExpanded && node.children) {
    for (const child of node.children) {
      renderNode(child, level + 1);
    }
  }
}

/**
 * ノードの展開/折りたたみを切り替え
 */
function toggleNodeExpansion(nodeId) {
  if (state.expandedNodes.has(nodeId)) {
    state.expandedNodes.delete(nodeId);
  } else {
    state.expandedNodes.add(nodeId);
  }

  // 再描画
  renderTree();
}

/**
 * ステータスバーの更新
 */
function updateStatus(message) {
  statusBar.textContent = message;
}

/**
 * エラーメッセージの表示
 */
function showError(message) {
  // 簡易的なアラート（将来的にはカスタム通知UIに置き換える）
  alert(message);
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
