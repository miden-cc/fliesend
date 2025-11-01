/**
 * fließend - Renderer Process
 * レンダラープロセスのメインスクリプト
 */
import { h, diff, render } from './vdom.js';
import { getState, setState, subscribe } from './store.js';
import { findNodeById, findParentNode, getVisibleNodes } from './tree-utils.js';

// DOM要素の取得
const openFolderBtn = document.getElementById('openFolderBtn');
const newFileBtn = document.getElementById('newFileBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const deleteBtn = document.getElementById('deleteBtn');
const outlineTree = document.getElementById('outlineTree');
const statusBar = document.getElementById('statusBar');
const loadingIndicator = document.getElementById('loadingIndicator');
const notificationContainer = document.getElementById('notification-container');

// Virtual DOM tree
let vTree;

/**
 * 初期化
 */
function init() {
  console.log('fließend initialized');
  updateStatus('準備完了');

  // イベントリスナーの設定
  setupEventListeners();
  subscribe(renderTree); // Subscribe to state changes
  renderTree(); // Initial render
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  openFolderBtn.addEventListener('click', handleOpenFolder);
  newFileBtn.addEventListener('click', () => handleCreateNode('file'));
  newFolderBtn.addEventListener('click', () => handleCreateNode('folder'));
  deleteBtn.addEventListener('click', handleDeleteNode);
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * フォルダを開く処理
 */
async function handleOpenFolder() {
  try {
    updateStatus('フォルダを選択中...');
    const folderPath = await window.electronAPI.openFolder();
    if (!folderPath) {
      updateStatus('準備完了');
      return;
    }

    showLoading(true);
    updateStatus('フォルダを読み込み中...');
    const tree = await window.electronAPI.readTree(folderPath);

    const expandedNodes = new Set();
    expandedNodes.add(tree.id);
    setState({
      rootPath: folderPath,
      tree,
      expandedNodes,
      selectedNodeId: tree.id, // ルートを選択状態にする
    });

    showLoading(false);
    updateStatus(`読み込み完了: ${folderPath}`);
  } catch (error) {
    console.error('Error opening folder:', error);
    showLoading(false);
    updateStatus('エラー: フォルダの読み込みに失敗しました');
    showNotification('フォルダの読み込みに失敗しました', 'error');
  }
}

/**
 * ノード作成処理
 */
async function handleCreateNode(type) {
  const { tree, selectedNodeId } = getState();
  if (!tree) {
    showNotification('まずフォルダを開いてください。', 'error');
    return;
  }

  let parentNode = selectedNodeId ? findNodeById(tree, selectedNodeId) : tree;
  if (!parentNode) parentNode = tree;

  if (parentNode.type === 'file') {
    parentNode = findParentNode(tree, parentNode.id) || tree;
  }

  const nodeName = prompt(`新しい${type === 'file' ? 'ファイル' : 'フォルダ'}名を入力してください:`, type === 'file' ? 'new-file.txt' : 'new-folder');
  if (!nodeName) return;

  try {
    updateStatus('作成中...');
    const newNode = await window.electronAPI.createNode(parentNode.path, nodeName, type);

    if (!parentNode.children) {
      parentNode.children = [];
    }
    parentNode.children.push(newNode);

    const { expandedNodes } = getState();
    const newExpandedNodes = new Set(expandedNodes);
    newExpandedNodes.add(parentNode.id);

    setState({ tree, expandedNodes: newExpandedNodes, selectedNodeId: newNode.id });
    updateStatus(`${type}を作成しました: ${nodeName}`);
  } catch (error) {
    console.error('Error creating node:', error);
    updateStatus('エラー: 作成に失敗しました');
    showNotification(`作成に失敗しました: ${error.message}`, 'error');
  }
}

/**
 * ノード削除処理
 */
async function handleDeleteNode() {
  const { tree, selectedNodeId } = getState();
  if (!selectedNodeId) {
    showNotification('削除するファイルまたはフォルダを選択してください。', 'error');
    return;
  }

  const nodeToDelete = findNodeById(tree, selectedNodeId);
  if (!nodeToDelete) return;

  if (nodeToDelete.id === tree.id) {
    showNotification('ルートフォルダは削除できません。', 'error');
    return;
  }

  const confirmation = confirm(`'${nodeToDelete.name}' を本当に削除しますか？この操作は元に戻せません。`);
  if (!confirmation) return;

  try {
    updateStatus('削除中...');
    await window.electronAPI.deleteNode(nodeToDelete.path);

    const parent = findParentNode(tree, selectedNodeId);
    if (parent && parent.children) {
      parent.children = parent.children.filter(child => child.id !== selectedNodeId);
    }

    setState({ tree, selectedNodeId: parent ? parent.id : null });
    updateStatus('削除しました');
  } catch (error) {
    console.error('Error deleting node:', error);
    updateStatus('エラー: 削除に失敗しました');
    showNotification(`削除に失敗しました: ${error.message}`, 'error');
  }
}

/**
 * ノード名変更処理
 */
async function handleRenameNode(nodeId, newName) {
  const { tree } = getState();
  const nodeToRename = findNodeById(tree, nodeId);
  if (!nodeToRename || nodeToRename.name === newName) return;

  try {
    updateStatus('名前を変更中...');
    const newPath = await window.electronAPI.renameNode(nodeToRename.path, newName);

    nodeToRename.name = newName;
    nodeToRename.path = newPath;

    setState({ tree });
    updateStatus('名前を変更しました');
  } catch (error) {
    console.error('Error renaming node:', error);
    updateStatus('エラー: 名前の変更に失敗しました');
    showNotification(`名前の変更に失敗しました: ${error.message}`, 'error');
  }
}

/**
 * ツリーを描画
 */
function renderTree() {
  const { tree, selectedNodeId, expandedNodes } = getState();
  const newVTree = tree ? renderNode(tree, 0, selectedNodeId, expandedNodes) : h('div', { class: 'empty-state' },
      h('p', {}, 'フォルダを選択して開始'),
      h('p', { class: 'empty-state-hint' }, '「フォルダを開く」ボタンをクリック')
  );

  const rootElement = outlineTree.childNodes[0];
  if (!vTree || !rootElement) {
    outlineTree.innerHTML = '';
    outlineTree.appendChild(render(newVTree));
  } else {
    const patch = diff(vTree, newVTree);
    patch(rootElement);
  }
  vTree = newVTree;
}

/**
 * ノードを描画（再帰的）
 */
function renderNode(node, level, selectedNodeId, expandedNodes) {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;

    let icon = '';
    if (node.type === 'folder') {
        icon = hasChildren ? (isExpanded ? '▼' : '▶') : '▪';
    } else {
        icon = '・';
    }

    const children = (node.type === 'folder' && isExpanded && node.children)
        ? node.children.map(child => renderNode(child, level + 1, selectedNodeId, expandedNodes))
        : [];

    const props = {
        class: `tree-node ${selectedNodeId === node.id ? 'selected' : ''}`,
        'data-node-id': node.id,
        'data-node-type': node.type,
        'data-node-name': node.name,
        style: `padding-left: ${level * 20}px`,
        onclick: (e) => {
            e.stopPropagation();
            selectNode(node.id);
        },
    };

    if (node.type === 'folder') {
        props.ondblclick = (e) => {
            e.stopPropagation();
            toggleNodeExpansion(node.id);
        };
    } else {
        props.ondblclick = (e) => {
            e.stopPropagation();
            openFileInExternalEditor(node.path);
        };
    }

    const nameElement = h('span', {
      class: 'tree-node-name',
      contenteditable: selectedNodeId === node.id,
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      },
      onblur: (e) => {
        handleRenameNode(node.id, e.target.textContent);
      }
    }, escapeHtml(node.name));

    return h('div', props,
        h('span', { class: 'tree-node-icon' }, icon),
        nameElement,
        ...children
    );
}


/**
 * ノードを選択
 */
function selectNode(nodeId) {
  setState({ selectedNodeId: nodeId });
}

/**
 * ノードの展開/折りたたみを切り替え
 */
function toggleNodeExpansion(nodeId) {
    const { expandedNodes } = getState();
    const newExpandedNodes = new Set(expandedNodes);
    if (newExpandedNodes.has(nodeId)) {
        newExpandedNodes.delete(nodeId);
    } else {
        newExpandedNodes.add(nodeId);
    }
    setState({ expandedNodes: newExpandedNodes });
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
  const { tree, selectedNodeId, expandedNodes } = getState();
  if (!tree) return;

  if (event.target.isContentEditable) {
      if (event.key === 'Escape') event.target.blur();
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
      if (selectedNodeId) {
        const node = findNodeById(tree, selectedNodeId);
        if (node && node.type === 'folder') {
          toggleNodeExpansion(selectedNodeId);
        }
      }
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (selectedNodeId) {
        const node = findNodeById(tree, selectedNodeId);
        if (node && node.type === 'folder' && !expandedNodes.has(selectedNodeId)) {
          toggleNodeExpansion(selectedNodeId);
        }
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (selectedNodeId) {
        const node = findNodeById(tree, selectedNodeId);
        if (node && node.type === 'folder' && expandedNodes.has(selectedNodeId)) {
          toggleNodeExpansion(selectedNodeId);
        }
      }
      break;
    case 'Tab':
      event.preventDefault();
      if (selectedNodeId) {
        if (event.shiftKey) {
          moveNodeUp();
        } else {
          moveNodeDown();
        }
      }
      break;
    case 'Delete':
    case 'Backspace':
      event.preventDefault();
      handleDeleteNode();
      break;
    case 'F2':
      event.preventDefault();
      if (selectedNodeId) {
        const nodeElement = outlineTree.querySelector(`[data-node-id="${selectedNodeId}"] .tree-node-name`);
        if (nodeElement) {
          nodeElement.focus();
          document.execCommand('selectAll', false, null);
        }
      }
      break;
  }
}

/**
 * 上方向にナビゲート
 */
function navigateUp() {
  const { tree, expandedNodes, selectedNodeId } = getState();
  const visibleNodes = getVisibleNodes(tree, expandedNodes);
  if (visibleNodes.length === 0) return;

  if (!selectedNodeId) {
    setState({ selectedNodeId: visibleNodes[0].id });
    return;
  }

  const currentIndex = visibleNodes.findIndex(n => n.id === selectedNodeId);
  if (currentIndex > 0) {
    setState({ selectedNodeId: visibleNodes[currentIndex - 1].id });
  }
}

/**
 * 下方向にナビゲート
 */
function navigateDown() {
  const { tree, expandedNodes, selectedNodeId } = getState();
  const visibleNodes = getVisibleNodes(tree, expandedNodes);
  if (visibleNodes.length === 0) return;

  if (!selectedNodeId) {
    setState({ selectedNodeId: visibleNodes[0].id });
    return;
  }

  const currentIndex = visibleNodes.findIndex(n => n.id === selectedNodeId);
  if (currentIndex >= 0 && currentIndex < visibleNodes.length - 1) {
    setState({ selectedNodeId: visibleNodes[currentIndex + 1].id });
  }
}

/**
 * Tab: 選択されたノードの階層を下げる
 */
async function moveNodeDown() {
    const { tree, selectedNodeId, expandedNodes } = getState();
    if (!selectedNodeId) return;

    const selectedNode = findNodeById(tree, selectedNodeId);
    if (!selectedNode || selectedNode.id === tree.id) {
        updateStatus('ルートフォルダは移動できません');
        return;
    }

    const parent = findParentNode(tree, selectedNodeId);
    if (!parent) return;

    const siblings = parent.children || [];
    const currentIndex = siblings.findIndex(n => n.id === selectedNodeId);

    if (currentIndex <= 0) {
        updateStatus('これ以上左にインデントできません');
        return;
    }

    const previousSibling = siblings[currentIndex - 1];
    if (previousSibling.type !== 'folder') {
        updateStatus('ファイルの下に移動することはできません');
        return;
    }

    try {
        updateStatus('移動中...');
        const newPath = await window.electronAPI.moveNode(selectedNode.path, previousSibling.path);

        siblings.splice(currentIndex, 1);
        if (!previousSibling.children) previousSibling.children = [];
        previousSibling.children.push(selectedNode);
        selectedNode.path = newPath;

        const newExpandedNodes = new Set(expandedNodes);
        newExpandedNodes.add(previousSibling.id);

        setState({ tree, expandedNodes: newExpandedNodes });
        updateStatus('移動しました');
    } catch (error) {
        console.error('Error moving node:', error);
        updateStatus('エラー: 移動に失敗しました');
        showNotification(`ノードの移動に失敗しました: ${error.message}`, 'error');
    }
}

/**
 * Shift+Tab: 選択されたノードの階層を上げる
 */
async function moveNodeUp() {
    const { tree, selectedNodeId } = getState();
    if (!selectedNodeId) return;

    const selectedNode = findNodeById(tree, selectedNodeId);
    if (!selectedNode || selectedNode.id === tree.id) {
        updateStatus('ルートフォルダは移動できません');
        return;
    }

    const parent = findParentNode(tree, selectedNodeId);
    if (!parent || parent.id === tree.id) {
        updateStatus('これ以上右にインデントできません');
        return;
    }

    const grandParent = findParentNode(tree, parent.id);
    if (!grandParent) return;

    try {
        updateStatus('移動中...');
        const newPath = await window.electronAPI.moveNode(selectedNode.path, grandParent.path);

        parent.children.splice(parent.children.findIndex(n => n.id === selectedNodeId), 1);

        const parentIndex = grandParent.children.findIndex(n => n.id === parent.id);
        grandParent.children.splice(parentIndex + 1, 0, selectedNode);
        selectedNode.path = newPath;

        setState({ tree });
        updateStatus('移動しました');
    } catch (error) {
        console.error('Error moving node:', error);
        updateStatus('エラー: 移動に失敗しました');
        showNotification(`ノードの移動に失敗しました: ${error.message}`, 'error');
    }
}

/**
 * ヘルパー関数
 */
function updateStatus(message) {
  statusBar.textContent = message;
}

function showLoading(show) {
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'flex' : 'none';
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  notificationContainer.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * アプリケーションの起動
 */
document.addEventListener('DOMContentLoaded', init);
