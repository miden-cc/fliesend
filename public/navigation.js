/**
 * fließend - Navigation Module
 * キーボードナビゲーションとノード移動の機能
 */

import { getState, setState } from './store.js';
import { findNodeById, findParentNode, getVisibleNodes } from './tree-utils.js';
import { updateStatus, showNotification } from './feedback.js';
import { withFsErrorHandling } from './error-handler.js';
import { canMoveNode, addToExpandedNodes } from './node-helpers.js';

/**
 * ノードを選択
 */
export function selectNode(nodeId) {
  setState({ selectedNodeId: nodeId });
}

/**
 * ノードの展開/折りたたみを切り替え
 */
export function toggleNodeExpansion(nodeId) {
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
 * 上方向にナビゲート
 */
export function navigateUp() {
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
export function navigateDown() {
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
 * Tab: 選択されたノードをインデント（階層を下げる）
 */
export async function indentNode() {
  const { tree, selectedNodeId, expandedNodes } = getState();
  if (!selectedNodeId) return;

  const selectedNode = findNodeById(tree, selectedNodeId);
  if (!canMoveNode(selectedNode, tree)) {
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
    const newPath = await withFsErrorHandling(
      () => window.electronAPI.moveNode(selectedNode.path, previousSibling.path),
      '移動'
    );

    siblings.splice(currentIndex, 1);
    if (!previousSibling.children) previousSibling.children = [];
    previousSibling.children.push(selectedNode);
    selectedNode.path = newPath;

    const newExpandedNodes = addToExpandedNodes(expandedNodes, previousSibling.id);
    setState({ tree, expandedNodes: newExpandedNodes });
  } catch (error) {
    // エラーは withFsErrorHandling で処理済み
  }
}

/**
 * Shift+Tab: 選択されたノードをアウトデント（階層を上げる）
 */
export async function outdentNode() {
  const { tree, selectedNodeId } = getState();
  if (!selectedNodeId) return;

  const selectedNode = findNodeById(tree, selectedNodeId);
  if (!canMoveNode(selectedNode, tree)) {
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
    const newPath = await withFsErrorHandling(
      () => window.electronAPI.moveNode(selectedNode.path, grandParent.path),
      '移動'
    );

    parent.children.splice(parent.children.findIndex(n => n.id === selectedNodeId), 1);

    const parentIndex = grandParent.children.findIndex(n => n.id === parent.id);
    grandParent.children.splice(parentIndex + 1, 0, selectedNode);
    selectedNode.path = newPath;

    setState({ tree });
  } catch (error) {
    // エラーは withFsErrorHandling で処理済み
  }
}
