/**
 * fließend - Event Handlers Module
 * ユーザー操作に対するイベントハンドラー
 */

import { getState, setState } from './store.js';
import { findNodeById, findParentNode } from './tree-utils.js';
import { updateStatus, showLoading, showNotification } from './feedback.js';
import { withFsErrorHandling, getSelectedNodeOrError, isRootNode } from './error-handler.js';
import { getParentFolder, addChildToNode, removeChildFromNode, addToExpandedNodes } from './node-helpers.js';

/**
 * フォルダを開く処理
 */
export async function handleOpenFolder() {
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
 * @param {string} type - 'file' または 'folder'
 */
export async function handleCreateNode(type) {
  const { tree, selectedNodeId, expandedNodes } = getState();
  if (!tree) {
    showNotification('まずフォルダを開いてください。', 'error');
    return;
  }

  const parentNode = getParentFolder(tree, selectedNodeId);

  try {
    const newNode = await withFsErrorHandling(
      () => window.electronAPI.createNode(parentNode.path, null, type),
      '作成'
    );

    addChildToNode(parentNode, newNode);
    const newExpandedNodes = addToExpandedNodes(expandedNodes, parentNode.id);

    setState({ tree, expandedNodes: newExpandedNodes, selectedNodeId: newNode.id });

    // 少し待ってから名前の変更を開始
    setTimeout(() => {
      const nodeElement = document.querySelector(`[data-node-id="${newNode.id}"] .tree-node-name`);
      if (nodeElement) {
        nodeElement.focus();
        document.execCommand('selectAll', false, null);
      }
    }, 100);
  } catch (error) {
    // エラーは withFsErrorHandling で処理済み
  }
}

/**
 * 兄弟フォルダ作成処理
 */
export async function handleCreateSiblingFolder() {
  const { tree, selectedNodeId } = getState();

  const selectedNode = getSelectedNodeOrError(
    tree,
    selectedNodeId,
    findNodeById,
    '基準となるファイルまたはフォルダを選択してください。'
  );
  if (!selectedNode) return;

  if (isRootNode(selectedNode, tree)) {
    showNotification('ルート直下には兄弟アイテムを作成できません。', 'error');
    return;
  }

  const parent = findParentNode(tree, selectedNodeId);
  if (!parent) {
    showNotification('親フォルダが見つかりません。', 'error');
    return;
  }

  try {
    const newNode = await withFsErrorHandling(
      () => window.electronAPI.createNode(parent.path, null, 'folder'),
      '作成'
    );

    addChildToNode(parent, newNode);

    setState({ tree, selectedNodeId: newNode.id });

    // 少し待ってから名前の変更を開始
    setTimeout(() => {
      const nodeElement = document.querySelector(`[data-node-id="${newNode.id}"] .tree-node-name`);
      if (nodeElement) {
        nodeElement.focus();
        document.execCommand('selectAll', false, null);
      }
    }, 100);
  } catch (error) {
    // エラーは withFsErrorHandling で処理済み
  }
}

/**
 * ノード削除処理
 */
export async function handleDeleteNode() {
  const { tree, selectedNodeId } = getState();

  const nodeToDelete = getSelectedNodeOrError(
    tree,
    selectedNodeId,
    findNodeById,
    '削除するファイルまたはフォルダを選択してください。'
  );
  if (!nodeToDelete) return;

  if (isRootNode(nodeToDelete, tree)) return;

  const confirmation = confirm(
    `'${nodeToDelete.name}' を本当に削除しますか？この操作は元に戻せません。`
  );
  if (!confirmation) return;

  try {
    await withFsErrorHandling(
      () => window.electronAPI.deleteNode(nodeToDelete.path),
      '削除'
    );

    const parent = findParentNode(tree, selectedNodeId);
    removeChildFromNode(parent, selectedNodeId);

    setState({ tree, selectedNodeId: parent ? parent.id : null });
  } catch (error) {
    // エラーは withFsErrorHandling で処理済み
  }
}

/**
 * ノード名変更処理
 */
export async function handleRenameNode(nodeId, newName) {
  const { tree } = getState();
  const nodeToRename = findNodeById(tree, nodeId);
  if (!nodeToRename) return;

  // If the node has a displayName, we are updating the metadata
  if (nodeToRename.displayName !== null && nodeToRename.displayName !== undefined) {
    if (nodeToRename.displayName === newName) return;
    try {
      const newPath = await withFsErrorHandling(
        () => window.electronAPI.updateNodeDisplayName(nodeToRename.path, newName),
        '表示名を変更'
      );

      // Update the node in the local state
      nodeToRename.displayName = newName;
      nodeToRename.name = newPath.split('/').pop(); // Update the folder name
      nodeToRename.path = newPath;

      setState({ tree });
    } catch (error) {
      // Error is handled by withFsErrorHandling
    }
  } else {
    // Otherwise, it's a normal rename
    if (nodeToRename.name === newName) return;
    try {
      const newPath = await withFsErrorHandling(
        () => window.electronAPI.renameNode(nodeToRename.path, newName),
        '名前を変更'
      );

      nodeToRename.name = newName;
      nodeToRename.path = newPath;

      setState({ tree });
    } catch (error) {
      // Error is handled by withFsErrorHandling
    }
  }
}

/**
 * ファイルを外部エディタで開く
 */
export async function openFileInExternalEditor(filePath) {
  try {
    await window.electronAPI.openFile(filePath);
    updateStatus(`ファイルを開きました: ${filePath}`);
  } catch (error) {
    console.error('Error opening file:', error);
    updateStatus('エラー: ファイルを開けませんでした');
  }
}
