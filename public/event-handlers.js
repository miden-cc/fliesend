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

  const nodeName = prompt(
    `新しい${type === 'file' ? 'ファイル' : 'フォルダ'}名を入力してください:`,
    type === 'file' ? 'new-file.txt' : 'new-folder'
  );
  if (!nodeName) return;

  try {
    const newNode = await withFsErrorHandling(
      () => window.electronAPI.createNode(parentNode.path, nodeName, type),
      '作成'
    );

    addChildToNode(parentNode, newNode);
    const newExpandedNodes = addToExpandedNodes(expandedNodes, parentNode.id);

    setState({ tree, expandedNodes: newExpandedNodes, selectedNodeId: newNode.id });
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
  if (!nodeToRename || nodeToRename.name === newName) return;

  try {
    const newPath = await withFsErrorHandling(
      () => window.electronAPI.renameNode(nodeToRename.path, newName),
      '名前を変更'
    );

    nodeToRename.name = newName;
    nodeToRename.path = newPath;

    setState({ tree });
  } catch (error) {
    // エラーは withFsErrorHandling で処理済み
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
