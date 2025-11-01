/**
 * fließend - Error Handler Module
 * 共通エラーハンドリングユーティリティ
 */

import { updateStatus, showNotification } from './feedback.js';

/**
 * 非同期操作を共通のエラーハンドリングでラップ
 * @param {Function} operation - 実行する非同期関数
 * @param {Object} messages - メッセージ設定
 * @param {string} messages.inProgress - 実行中のメッセージ
 * @param {string} messages.success - 成功時のメッセージ
 * @param {string} messages.error - エラー時のメッセージ
 * @returns {Promise<any>} 操作の結果
 */
export async function withErrorHandling(operation, messages = {}) {
  const {
    inProgress = '処理中...',
    success = '完了',
    error = 'エラーが発生しました'
  } = messages;

  try {
    updateStatus(inProgress);
    const result = await operation();
    updateStatus(success);
    return result;
  } catch (err) {
    console.error(`Error: ${error}`, err);
    updateStatus(`エラー: ${error}`);
    showNotification(`${error}: ${err.message}`, 'error');
    throw err; // 必要に応じて上位で処理できるように再スロー
  }
}

/**
 * ファイルシステム操作用の共通エラーハンドラー
 * @param {Function} operation - 実行する非同期関数
 * @param {string} operationName - 操作名（日本語）
 * @returns {Promise<any>} 操作の結果
 */
export async function withFsErrorHandling(operation, operationName) {
  return withErrorHandling(operation, {
    inProgress: `${operationName}中...`,
    success: `${operationName}しました`,
    error: `${operationName}に失敗しました`
  });
}

/**
 * 選択されたノードを取得し、エラーハンドリング
 * @param {Object} tree - ツリー構造
 * @param {string} selectedNodeId - 選択されたノードID
 * @param {Function} findNodeById - ノード検索関数
 * @param {string} errorMessage - エラーメッセージ
 * @returns {Object|null} ノードオブジェクトまたはnull
 */
export function getSelectedNodeOrError(tree, selectedNodeId, findNodeById, errorMessage) {
  if (!selectedNodeId) {
    showNotification(errorMessage, 'error');
    return null;
  }

  const node = findNodeById(tree, selectedNodeId);
  if (!node) {
    showNotification('選択されたノードが見つかりません', 'error');
    return null;
  }

  return node;
}

/**
 * ルートノードかどうかをチェック
 * @param {Object} node - チェックするノード
 * @param {Object} tree - ルートツリー
 * @returns {boolean} ルートノードの場合true
 */
export function isRootNode(node, tree) {
  if (node.id === tree.id) {
    showNotification('ルートフォルダは操作できません', 'error');
    return true;
  }
  return false;
}
