/**
 * fließend - User Feedback Module
 * ユーザーフィードバック関連の機能
 */

// DOM要素の参照
const statusBar = document.getElementById('statusBar');
const loadingIndicator = document.getElementById('loadingIndicator');
const notificationContainer = document.getElementById('notification-container');

/**
 * ステータスバーのメッセージを更新
 */
export function updateStatus(message) {
  statusBar.textContent = message;
}

/**
 * ローディングインジケーターの表示/非表示
 */
export function showLoading(show) {
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'flex' : 'none';
  }
}

/**
 * 通知を表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 通知のタイプ ('info', 'error', 'success')
 */
export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  notificationContainer.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}
