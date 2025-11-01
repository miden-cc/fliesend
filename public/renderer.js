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
  expandedNodes: new Set(),
  selectedNodeId: null
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

  // キーボードナビゲーション
  document.addEventListener('keydown', handleKeyDown);
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

  // 選択状態の反映
  if (state.selectedNodeId === node.id) {
    nodeElement.classList.add('selected');
  }

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
  nodeElement.addEventListener('click', (e) => {
    e.stopPropagation();
    selectNode(node.id);

    if (node.type === 'folder') {
      toggleNodeExpansion(node.id);
    }
  });

  // ダブルクリックイベント（ファイルの場合）
  if (node.type === 'file') {
    nodeElement.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      openFileInExternalEditor(node.path);
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
 * ノードを選択
 */
function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  // 再描画は不要（renderTree()が呼ばれる場合に反映される）
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
 * ファイルを外部エディタで開く
 */
async function openFileInExternalEditor(filePath) {
  try {
    await window.electronAPI.openFile(filePath);
    updateStatus(`ファイルを開きました: ${filePath}`);
  } catch (error) {
    console.error('Error opening file:', error);
    updateStatus('エラー: ファイルを開けませんでした');
  }
}

/**
 * キーボードイベントのハンドリング
 */
function handleKeyDown(event) {
  if (!state.tree) {
    return;
  }

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      navigateUp();
      break;
    case 'ArrowDown':
      event.preventDefault();
      navigateDown();
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (state.selectedNodeId) {
        const node = findNodeById(state.tree, state.selectedNodeId);
        if (node && node.type === 'folder') {
          toggleNodeExpansion(state.selectedNodeId);
        }
      }
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (state.selectedNodeId) {
        const node = findNodeById(state.tree, state.selectedNodeId);
        if (node && node.type === 'folder' && !state.expandedNodes.has(state.selectedNodeId)) {
          toggleNodeExpansion(state.selectedNodeId);
        }
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (state.selectedNodeId) {
        const node = findNodeById(state.tree, state.selectedNodeId);
        if (node && node.type === 'folder' && state.expandedNodes.has(state.selectedNodeId)) {
          toggleNodeExpansion(state.selectedNodeId);
        }
      }
      break;
    case 'Tab':
      event.preventDefault();
      if (state.selectedNodeId) {
        if (event.shiftKey) {
          // Shift+Tab: 階層を上げる
          moveNodeUp();
        } else {
          // Tab: 階層を下げる
          moveNodeDown();
        }
      }
      break;
  }
}

/**
 * 上方向にナビゲート
 */
function navigateUp() {
  const visibleNodes = getVisibleNodes();
  if (visibleNodes.length === 0) return;

  if (!state.selectedNodeId) {
    // 何も選択されていない場合は最初のノードを選択
    state.selectedNodeId = visibleNodes[0].id;
    renderTree();
    return;
  }

  const currentIndex = visibleNodes.findIndex(n => n.id === state.selectedNodeId);
  if (currentIndex > 0) {
    state.selectedNodeId = visibleNodes[currentIndex - 1].id;
    renderTree();
  }
}

/**
 * 下方向にナビゲート
 */
function navigateDown() {
  const visibleNodes = getVisibleNodes();
  if (visibleNodes.length === 0) return;

  if (!state.selectedNodeId) {
    // 何も選択されていない場合は最初のノードを選択
    state.selectedNodeId = visibleNodes[0].id;
    renderTree();
    return;
  }

  const currentIndex = visibleNodes.findIndex(n => n.id === state.selectedNodeId);
  if (currentIndex >= 0 && currentIndex < visibleNodes.length - 1) {
    state.selectedNodeId = visibleNodes[currentIndex + 1].id;
    renderTree();
  }
}

/**
 * 現在表示されているノードのリストを取得（深さ優先順）
 */
function getVisibleNodes() {
  const visible = [];

  function traverse(node) {
    visible.push(node);

    if (node.type === 'folder' && state.expandedNodes.has(node.id) && node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  if (state.tree) {
    traverse(state.tree);
  }

  return visible;
}

/**
 * IDでノードを検索
 */
function findNodeById(node, targetId) {
  if (node.id === targetId) {
    return node;
  }

  if (node.type === 'folder' && node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Tab: 選択されたノードの階層を下げる
 * 直前の兄弟ノードの子として移動
 */
async function moveNodeDown() {
  if (!state.selectedNodeId) return;

  const selectedNode = findNodeById(state.tree, state.selectedNodeId);
  if (!selectedNode) return;

  // ルートノードは移動できない
  if (selectedNode.id === state.tree.id) {
    updateStatus('ルートフォルダは移動できません');
    return;
  }

  // 親ノードと兄弟ノードを取得
  const parent = findParentNode(state.tree, state.selectedNodeId);
  if (!parent) return;

  const siblings = parent.children || [];
  const currentIndex = siblings.findIndex(n => n.id === state.selectedNodeId);

  if (currentIndex <= 0) {
    // 最初の兄弟なので移動できない
    updateStatus('これ以上左にインデントできません');
    return;
  }

  const previousSibling = siblings[currentIndex - 1];

  // 前の兄弟がフォルダでない場合は移動できない
  if (previousSibling.type !== 'folder') {
    updateStatus('ファイルの下に移動することはできません');
    return;
  }

  try {
    updateStatus('移動中...');

    // ファイルシステムで移動
    const newPath = await window.electronAPI.moveNode(
      selectedNode.path,
      previousSibling.path
    );

    // ツリー構造を更新
    siblings.splice(currentIndex, 1);
    if (!previousSibling.children) {
      previousSibling.children = [];
    }
    previousSibling.children.push(selectedNode);
    selectedNode.path = newPath;

    // 前の兄弟を展開
    state.expandedNodes.add(previousSibling.id);

    // 再描画
    renderTree();
    updateStatus('移動しました');
  } catch (error) {
    console.error('Error moving node:', error);
    updateStatus('エラー: 移動に失敗しました');
    showError('ノードの移動に失敗しました: ' + error.message);
  }
}

/**
 * Shift+Tab: 選択されたノードの階層を上げる
 * 親の兄弟として移動（親の直後）
 */
async function moveNodeUp() {
  if (!state.selectedNodeId) return;

  const selectedNode = findNodeById(state.tree, state.selectedNodeId);
  if (!selectedNode) return;

  // ルートノードは移動できない
  if (selectedNode.id === state.tree.id) {
    updateStatus('ルートフォルダは移動できません');
    return;
  }

  // 親ノードを取得
  const parent = findParentNode(state.tree, state.selectedNodeId);
  if (!parent) return;

  // 親がルートの場合は移動できない
  if (parent.id === state.tree.id) {
    updateStatus('これ以上右にインデントできません');
    return;
  }

  // 祖父母ノードを取得
  const grandParent = findParentNode(state.tree, parent.id);
  if (!grandParent) return;

  try {
    updateStatus('移動中...');

    // ファイルシステムで移動
    const newPath = await window.electronAPI.moveNode(
      selectedNode.path,
      grandParent.path
    );

    // ツリー構造を更新
    // 親の子リストから削除
    const parentChildren = parent.children || [];
    const currentIndex = parentChildren.findIndex(n => n.id === state.selectedNodeId);
    if (currentIndex >= 0) {
      parentChildren.splice(currentIndex, 1);
    }

    // 祖父母の子リストに追加（親の直後）
    const grandParentChildren = grandParent.children || [];
    const parentIndex = grandParentChildren.findIndex(n => n.id === parent.id);
    grandParentChildren.splice(parentIndex + 1, 0, selectedNode);
    selectedNode.path = newPath;

    // 再描画
    renderTree();
    updateStatus('移動しました');
  } catch (error) {
    console.error('Error moving node:', error);
    updateStatus('エラー: 移動に失敗しました');
    showError('ノードの移動に失敗しました: ' + error.message);
  }
}

/**
 * 親ノードを検索
 */
function findParentNode(node, targetId) {
  if (node.children) {
    for (const child of node.children) {
      if (child.id === targetId) {
        return node;
      }

      const found = findParentNode(child, targetId);
      if (found) {
        return found;
      }
    }
  }

  return null;
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
