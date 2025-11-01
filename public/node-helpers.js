/**
 * fließend - Node Helpers Module
 * ノード操作の共通ヘルパー関数
 */

import { findNodeById, findParentNode } from './tree-utils.js';

/**
 * 選択されたノードとその親ノードを取得
 * @param {Object} tree - ツリー構造
 * @param {string} selectedNodeId - 選択されたノードID
 * @returns {Object} { node, parent } - ノードと親ノード
 */
export function getNodeWithParent(tree, selectedNodeId) {
  const node = findNodeById(tree, selectedNodeId);
  const parent = node ? findParentNode(tree, selectedNodeId) : null;
  return { node, parent };
}

/**
 * 親フォルダを取得（ファイルが選択されている場合はその親を返す）
 * @param {Object} tree - ツリー構造
 * @param {string} selectedNodeId - 選択されたノードID
 * @returns {Object} 親フォルダノード
 */
export function getParentFolder(tree, selectedNodeId) {
  if (!selectedNodeId) return tree;

  let parentNode = findNodeById(tree, selectedNodeId);
  if (!parentNode) return tree;

  // ファイルが選択されている場合は、その親フォルダを使用
  if (parentNode.type === 'file') {
    parentNode = findParentNode(tree, parentNode.id) || tree;
  }

  return parentNode;
}

/**
 * ノードが移動可能かチェック
 * @param {Object} node - チェックするノード
 * @param {Object} tree - ルートツリー
 * @returns {boolean} 移動可能な場合true
 */
export function canMoveNode(node, tree) {
  return node && node.id !== tree.id;
}

/**
 * 子ノードを親に追加（存在しない場合は配列を初期化）
 * @param {Object} parent - 親ノード
 * @param {Object} child - 追加する子ノード
 */
export function addChildToNode(parent, child) {
  if (!parent.children) {
    parent.children = [];
  }
  parent.children.push(child);
}

/**
 * 親ノードから子ノードを削除
 * @param {Object} parent - 親ノード
 * @param {string} childId - 削除する子のID
 */
export function removeChildFromNode(parent, childId) {
  if (parent && parent.children) {
    parent.children = parent.children.filter(child => child.id !== childId);
  }
}

/**
 * 展開ノードのSetを更新
 * @param {Set} expandedNodes - 現在の展開ノードSet
 * @param {string} nodeId - 追加するノードID
 * @returns {Set} 新しい展開ノードSet
 */
export function addToExpandedNodes(expandedNodes, nodeId) {
  const newExpandedNodes = new Set(expandedNodes);
  newExpandedNodes.add(nodeId);
  return newExpandedNodes;
}
