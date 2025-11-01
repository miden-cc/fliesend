/**
 * fließend - Renderer Process
 * レンダラープロセスのメインスクリプト
 */

// DOM要素の取得
const openFolderBtn = document.getElementById('openFolderBtn');
const outlineTree = document.getElementById('outlineTree');
const statusBar = document.getElementById('statusBar');

// アプリケーション状態
let currentTree = null;
let rootPath = null;
let expandedNodes = new Set(); // 展開されているノードのIDセット
let selectedNodeId = null; // 選択中のノードID
let nodesMap = new Map(); // ID -> Node のマップ

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

  // キーボードイベント
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * フォルダを開く処理
 */
async function handleOpenFolder() {
  try {
    updateStatus('フォルダを選択中...');

    // フォルダ選択ダイアログを表示
    const selectedPath = await window.electronAPI.openFolderDialog();

    if (!selectedPath) {
      updateStatus('準備完了');
      return;
    }

    rootPath = selectedPath;
    updateStatus(`フォルダを読み込み中: ${rootPath}`);

    // ツリーを読み込み
    const result = await window.electronAPI.readTree(rootPath);

    if (!result.success) {
      updateStatus(`エラー: ${result.error}`);
      console.error('Failed to read tree:', result.error);
      return;
    }

    currentTree = result.data;

    // ノードマップを構築
    buildNodesMap(currentTree);

    // ルートレベルのフォルダは初期状態で展開
    currentTree.forEach(node => {
      if (node.type === 'folder') {
        expandedNodes.add(node.id);
      }
    });

    renderTree();
    updateStatus(`読み込み完了: ${countNodes(currentTree)} 個のアイテム`);

  } catch (error) {
    updateStatus('エラーが発生しました');
    console.error('Error opening folder:', error);
  }
}

/**
 * ノードマップを構築（再帰的）
 */
function buildNodesMap(nodes, parentId = null) {
  if (!nodes) return;

  nodes.forEach(node => {
    // 親IDを設定
    node.parentId = parentId;
    nodesMap.set(node.id, node);
    if (node.children) {
      buildNodesMap(node.children, node.id);
    }
  });
}

/**
 * ツリーをレンダリング
 */
function renderTree() {
  if (!currentTree || currentTree.length === 0) {
    outlineTree.innerHTML = `
      <div class="empty-state">
        <p>このフォルダは空です</p>
      </div>
    `;
    return;
  }

  outlineTree.innerHTML = '';
  renderNodes(currentTree, 0);
}

/**
 * ノードを再帰的にレンダリング
 */
function renderNodes(nodes, level) {
  if (!nodes) return;

  nodes.forEach(node => {
    const nodeElement = createNodeElement(node, level);
    outlineTree.appendChild(nodeElement);

    // フォルダが展開されている場合、子要素をレンダリング
    if (node.type === 'folder' &&
        node.children &&
        node.children.length > 0 &&
        expandedNodes.has(node.id)) {
      renderNodes(node.children, level + 1);
    }
  });
}

/**
 * ノード要素を作成
 */
function createNodeElement(node, level) {
  const div = document.createElement('div');
  div.className = 'tree-node';
  div.dataset.nodeId = node.id;
  div.dataset.nodeType = node.type;
  div.style.paddingLeft = `${level * 20 + 10}px`;

  // 選択状態のクラスを追加
  if (node.id === selectedNodeId) {
    div.classList.add('selected');
  }

  // フォルダの場合は展開インジケーターを追加
  if (node.type === 'folder') {
    const indicator = document.createElement('span');
    indicator.className = 'expand-indicator';
    const isExpanded = expandedNodes.has(node.id);
    indicator.textContent = isExpanded ? '∨' : '>';
    div.appendChild(indicator);
  }

  // バレット
  const bullet = document.createElement('span');
  bullet.className = 'bullet';
  bullet.textContent = '・';
  div.appendChild(bullet);

  // ノード名
  const name = document.createElement('span');
  name.className = 'node-name';
  name.textContent = node.name;

  // フォルダの場合はスラッシュを追加
  if (node.type === 'folder') {
    name.textContent += '/';
  }

  div.appendChild(name);

  // イベントリスナーを追加
  div.addEventListener('click', () => handleNodeClick(node));

  return div;
}

/**
 * ノードクリック処理
 */
function handleNodeClick(node) {
  // 選択状態を更新
  selectedNodeId = node.id;

  // フォルダの場合は展開/折りたたみを切り替え
  if (node.type === 'folder') {
    toggleNodeExpansion(node.id);
  }

  // 再レンダリング
  renderTree();
}

/**
 * ノードの展開/折りたたみを切り替え
 */
function toggleNodeExpansion(nodeId) {
  if (expandedNodes.has(nodeId)) {
    expandedNodes.delete(nodeId);
  } else {
    expandedNodes.add(nodeId);
  }
}

/**
 * キーボードイベント処理
 */
function handleKeyDown(event) {
  if (!selectedNodeId || !nodesMap.has(selectedNodeId)) {
    return;
  }

  const selectedNode = nodesMap.get(selectedNodeId);

  switch (event.key) {
    case ' ': // Space: フォルダの展開/折りたたみ
      event.preventDefault();
      if (selectedNode.type === 'folder') {
        toggleNodeExpansion(selectedNodeId);
        renderTree();
      }
      break;

    case 'ArrowUp': // ↑: 前のノードへ移動
      event.preventDefault();
      selectPreviousNode();
      break;

    case 'ArrowDown': // ↓: 次のノードへ移動
      event.preventDefault();
      selectNextNode();
      break;

    case 'ArrowLeft': // ←: フォルダを折りたたむ
      event.preventDefault();
      if (selectedNode.type === 'folder' && expandedNodes.has(selectedNodeId)) {
        expandedNodes.delete(selectedNodeId);
        renderTree();
      }
      break;

    case 'ArrowRight': // →: フォルダを展開
      event.preventDefault();
      if (selectedNode.type === 'folder' && !expandedNodes.has(selectedNodeId)) {
        expandedNodes.add(selectedNodeId);
        renderTree();
      }
      break;

    case 'Tab': // Tab/Shift+Tab: 階層変更
      event.preventDefault();
      if (event.shiftKey) {
        // Shift+Tab: 階層を上げる
        moveNodeUp(selectedNodeId);
      } else {
        // Tab: 階層を下げる
        moveNodeDown(selectedNodeId);
      }
      break;
  }
}

/**
 * 前のノードを選択
 */
function selectPreviousNode() {
  const visibleNodes = getVisibleNodes();
  const currentIndex = visibleNodes.findIndex(n => n.id === selectedNodeId);

  if (currentIndex > 0) {
    selectedNodeId = visibleNodes[currentIndex - 1].id;
    renderTree();
    scrollToSelectedNode();
  }
}

/**
 * 次のノードを選択
 */
function selectNextNode() {
  const visibleNodes = getVisibleNodes();
  const currentIndex = visibleNodes.findIndex(n => n.id === selectedNodeId);

  if (currentIndex < visibleNodes.length - 1) {
    selectedNodeId = visibleNodes[currentIndex + 1].id;
    renderTree();
    scrollToSelectedNode();
  }
}

/**
 * 表示中のノードをフラットなリストで取得
 */
function getVisibleNodes() {
  const visible = [];

  function collectVisible(nodes) {
    if (!nodes) return;

    nodes.forEach(node => {
      visible.push(node);

      if (node.type === 'folder' &&
          node.children &&
          expandedNodes.has(node.id)) {
        collectVisible(node.children);
      }
    });
  }

  collectVisible(currentTree);
  return visible;
}

/**
 * 選択中のノードまでスクロール
 */
function scrollToSelectedNode() {
  const selectedElement = outlineTree.querySelector('.tree-node.selected');
  if (selectedElement) {
    selectedElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }
}

/**
 * ノード数をカウント
 */
function countNodes(nodes) {
  if (!nodes) return 0;

  let count = nodes.length;
  nodes.forEach(node => {
    if (node.children) {
      count += countNodes(node.children);
    }
  });

  return count;
}

/**
 * ステータスバーの更新
 */
function updateStatus(message) {
  statusBar.textContent = message;
}

// ========================================
// 階層変更機能（Tab/Shift+Tab）
// ========================================

/**
 * Tab: ノードを一段階下げる（前の兄弟の子にする）
 */
async function moveNodeDown(nodeId) {
  const node = nodesMap.get(nodeId);
  if (!node) return;

  // 兄弟ノードを取得
  const siblings = getSiblings(nodeId);
  const currentIndex = siblings.findIndex(n => n.id === nodeId);

  // 最初の兄弟の場合は移動不可
  if (currentIndex === 0) {
    updateStatus('これ以上下げられません（最初のアイテムです）');
    return;
  }

  // 前の兄弟を取得
  const previousSibling = siblings[currentIndex - 1];

  // 前の兄弟がフォルダでない場合は移動不可
  if (previousSibling.type !== 'folder') {
    updateStatus('前のアイテムがフォルダではないため移動できません');
    return;
  }

  // 前の兄弟フォルダの中に移動
  await moveNodeTo(node, previousSibling);
}

/**
 * Shift+Tab: ノードを一段階上げる（親の兄弟にする）
 */
async function moveNodeUp(nodeId) {
  const node = nodesMap.get(nodeId);
  if (!node) return;

  // 親ノードを取得
  if (!node.parentId) {
    updateStatus('これ以上上げられません（ルートレベルです）');
    return;
  }

  const parent = nodesMap.get(node.parentId);
  if (!parent) return;

  // 祖父母ノードを取得（親の親）
  const grandParent = parent.parentId ? nodesMap.get(parent.parentId) : null;

  // 親の直後に移動
  await moveNodeTo(node, grandParent, parent);
}

/**
 * ノードを指定の親の子として移動
 * @param {Object} node - 移動するノード
 * @param {Object|null} newParent - 新しい親ノード（nullの場合はルートレベル）
 * @param {Object|null} afterNode - この兄弟の直後に配置（指定しない場合は末尾）
 */
async function moveNodeTo(node, newParent, afterNode = null) {
  try {
    updateStatus('移動中...');

    // 新しい親のパスを決定
    const newParentPath = newParent ? newParent.path : rootPath;

    // ファイルシステムに移動を実行
    const result = await window.electronAPI.moveNode(
      node.path,
      newParentPath,
      null // 名前は変更しない
    );

    if (!result.success) {
      updateStatus(`エラー: ${result.error}`);
      return;
    }

    // ツリー構造を更新
    updateTreeStructure(node, newParent, afterNode, result.newPath);

    // 新しい親を展開
    if (newParent) {
      expandedNodes.add(newParent.id);
    }

    // 再レンダリング
    renderTree();

    updateStatus('移動完了');

  } catch (error) {
    updateStatus('移動中にエラーが発生しました');
    console.error('Error in moveNodeTo:', error);
  }
}

/**
 * ツリー構造を更新（ノード移動後）
 */
function updateTreeStructure(node, newParent, afterNode, newPath) {
  // 古い親から削除
  const oldParent = node.parentId ? nodesMap.get(node.parentId) : null;

  if (oldParent && oldParent.children) {
    const index = oldParent.children.findIndex(n => n.id === node.id);
    if (index !== -1) {
      oldParent.children.splice(index, 1);
    }
  } else {
    // ルートレベルから削除
    const index = currentTree.findIndex(n => n.id === node.id);
    if (index !== -1) {
      currentTree.splice(index, 1);
    }
  }

  // 新しい親に追加
  node.parentId = newParent ? newParent.id : null;
  node.path = newPath;

  if (newParent) {
    if (!newParent.children) {
      newParent.children = [];
    }

    if (afterNode) {
      // afterNodeの直後に挿入
      const insertIndex = newParent.children.findIndex(n => n.id === afterNode.id);
      newParent.children.splice(insertIndex + 1, 0, node);
    } else {
      // 末尾に追加
      newParent.children.push(node);
    }
  } else {
    // ルートレベルに追加
    if (afterNode) {
      const insertIndex = currentTree.findIndex(n => n.id === afterNode.id);
      currentTree.splice(insertIndex + 1, 0, node);
    } else {
      currentTree.push(node);
    }
  }

  // 子ノードのパスも更新（再帰的）
  updateChildrenPaths(node);
}

/**
 * 子ノードのパスを再帰的に更新
 */
function updateChildrenPaths(parent) {
  if (!parent.children) return;

  parent.children.forEach(child => {
    const parentPath = parent.path;
    child.path = parentPath + '/' + child.name;

    if (child.children) {
      updateChildrenPaths(child);
    }
  });
}

/**
 * 兄弟ノードを取得
 */
function getSiblings(nodeId) {
  const node = nodesMap.get(nodeId);
  if (!node) return [];

  if (node.parentId) {
    const parent = nodesMap.get(node.parentId);
    return parent && parent.children ? parent.children : [];
  } else {
    // ルートレベルのノード
    return currentTree;
  }
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
