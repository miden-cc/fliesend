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
 * ノード削除処理
 */
export async function handleDeleteNode(nodeIdToDelete) {
  const { tree, selectedNodeId } = getState();
  const id = nodeIdToDelete || selectedNodeId;

  const nodeToDelete = getSelectedNodeOrError(
    tree,
    id,
    findNodeById,
    '削除するファイルまたはフォルダを選択してください。'
  );
  if (!nodeToDelete) return;

  if (isRootNode(nodeToDelete, tree)) return;

  try {
    await withFsErrorHandling(
      () => window.electronAPI.deleteNode(nodeToDelete.path),
      '削除'
    );

    const parent = findParentNode(tree, id);
    removeChildFromNode(parent, id);

    setState({ tree, selectedNodeId: parent ? parent.id : null });
  } catch (error) {
    // Handle error
  }
}

/**
 * ノード名変更処理
 */
export async function handleRenameNode(nodeId, newName) {
  if (!newName || newName.trim() === '') {
    handleDeleteNode(nodeId);
    return;
  }

  const { tree } = getState();
  const nodeToRename = findNodeById(tree, nodeId);
  if (!nodeToRename || nodeToRename.displayName === newName) return;

  try {
    const newPath = await withFsErrorHandling(
      () => window.electronAPI.updateNodeDisplayName(nodeToRename.path, newName),
      '表示名を変更'
    );

    nodeToRename.displayName = newName;
    nodeToRename.name = newPath.split('/').pop();
    nodeToRename.path = newPath;

    setState({ tree });
  } catch (error) {
    // Handle error
  }
}

/**
 * Get cursor position within a contenteditable element
 */
function getCursorPosition(element) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return {
    start: range.startOffset,
    end: range.endOffset,
    isAtStart: range.startOffset === 0,
    isAtEnd: range.startOffset === element.textContent.length,
  };
}

/**
 * Handle Enter key press in an outliner node
 */
export async function handleEnterKey(event, nodeId) {
  const { tree } = getState();
  const selectedNode = findNodeById(tree, nodeId);
  if (!selectedNode || isRootNode(selectedNode, tree)) return;

  const parent = findParentNode(tree, nodeId);
  if (!parent) return;

  try {
    const newNode = await withFsErrorHandling(
      () => window.electronAPI.createNode(parent.path, null, 'folder'),
      '作成'
    );

    const currentIndex = parent.children.findIndex(child => child.id === nodeId);
    parent.children.splice(currentIndex + 1, 0, newNode);

    setState({ tree, selectedNodeId: newNode.id });

    setTimeout(() => {
      const nodeElement = document.querySelector(`[data-node-id="${newNode.id}"] .tree-node-name`);
      if (nodeElement) nodeElement.focus();
    }, 50);

  } catch (error) {
    // Handle error
  }
}

/**
 * Handle Backspace key press in an outliner node
 */
export async function handleBackspaceKey(event, nodeId) {
  const element = event.target;
  const position = getCursorPosition(element);

  if (!position || !position.isAtStart || position.start !== position.end) return;

  event.preventDefault();

  const { tree } = getState();
  const parent = findParentNode(tree, nodeId);
  if (!parent) return;

  const nodeIndex = parent.children.findIndex(child => child.id === nodeId);
  if (nodeIndex <= 0) return;

  const sourceNode = parent.children[nodeIndex];
  const targetNode = parent.children[nodeIndex - 1];

  handleMergeNodes(sourceNode, targetNode);
}

/**
 * Merge two nodes (source into target)
 */
async function handleMergeNodes(sourceNode, targetNode) {
  const { tree } = getState();
  const originalTargetName = targetNode.displayName;
  const textToAppend = sourceNode.displayName;

  try {
    await withFsErrorHandling(
      () => window.electronAPI.mergeNodes(sourceNode.path, targetNode.path),
      '結合'
    );

    const newDisplayName = originalTargetName + textToAppend;
    const newPath = await withFsErrorHandling(
      () => window.electronAPI.updateNodeDisplayName(targetNode.path, newDisplayName),
      '表示名を変更'
    );

    targetNode.displayName = newDisplayName;
    targetNode.name = newPath.split('/').pop();
    targetNode.path = newPath;

    if (sourceNode.children && sourceNode.children.length > 0) {
      if (!targetNode.children) targetNode.children = [];
      targetNode.children.push(...sourceNode.children);
    }

    const parent = findParentNode(tree, sourceNode.id);
    removeChildFromNode(parent, sourceNode.id);

    setState({ tree, selectedNodeId: targetNode.id });

    setTimeout(() => {
      const nodeElement = document.querySelector(`[data-node-id="${targetNode.id}"] .tree-node-name`);
      if (nodeElement) {
        nodeElement.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(nodeElement.childNodes[0], originalTargetName.length);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 50);

  } catch (error) {
    // Handle error
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
