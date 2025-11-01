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
function buildNodesMap(nodes) {
  if (!nodes) return;

  nodes.forEach(node => {
    nodesMap.set(node.id, node);
    if (node.children) {
      buildNodesMap(node.children);
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
